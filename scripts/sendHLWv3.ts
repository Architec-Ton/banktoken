import { Blockchain, EmulationError, SandboxContract, createShardAccount, internal } from '@ton/sandbox';
import { Builder, beginCell, Cell, SendMode, toNano, Address, internal as internal_relaxed, Dictionary, BitString, OutActionSendMsg } from '@ton/core';
import {HighloadWalletV3, TIMEOUT_SIZE, TIMESTAMP_SIZE} from '../wrappers/HighloadWalletV3';
import '@ton/test-utils';
import { getSecureRandomBytes, KeyPair, keyPairFromSeed, mnemonicToPrivateKey } from "ton-crypto";
import { randomBytes } from "crypto";
import {SUBWALLET_ID, Errors, DEFAULT_TIMEOUT, maxKeyCount, maxShift} from "./imports/const";
import { NetworkProvider, compile,createNetworkProvider } from '@ton/blueprint';
import { getRandomInt } from '../utils';
import { findTransactionRequired, randomAddress } from '@ton/test-utils';
import { MsgGenerator } from '../wrappers/MsgGenerator';
import {HighloadQueryId} from "../wrappers/HighloadQueryId";
import {Bonus, storeBonus} from '../build/BanksCrowdSaleV2/tact_BanksCrowdSaleV2';
import { parse } from 'csv-parse';
// import { env } from  'node:process';
import 'dotenv/config'
import fs from 'node:fs';


    let keyPair: KeyPair;
    let code: Cell;

    let blockchain: Blockchain;
    // let highloadWalletV3: SandboxContract<HighloadWalletV3>;
    let highloadWalletV3: any; // OpenedContract<HighloadWalletV3>

    let shouldRejectWith: (p: Promise<unknown>, code: number) => Promise<void>;
    let getContractData: (address: Address) => Promise<Cell>;
    let getContractCode: (address: Address) => Promise<Cell>;
    require('dotenv').config()
  

    export async function run(provider: NetworkProvider, args: string[]) {

        const ui = provider.ui();
        keyPair = await  mnemonicToPrivateKey(process.env.WALLET_MNEMONIC!.split(' '));

        const address_HLW = Address.parse(process.env.HLWCONTRACT_ADDRESS!);
        if (!(await provider.isContractDeployed(address_HLW))) {
            ui.write(`Error: HLW Contract at address ${address_HLW} is not deployed!`);
            return;
        }
        const address_CROWDSALE = Address.parse(process.env.CROWDSALE_ADDRESS!);
        // const address = Address.parse('EQAKBlWOqJDIEQ8t3jIAXO06N1s9utti-1JoVUuWCX_5yPIY');
        //                             EQAKBlWOqJDIEQ8t3jIAXO06N1s9utti-1JoVUuWCX_5yPIY
        if (!(await provider.isContractDeployed(address_CROWDSALE))) {
            ui.write(`Error: HLW Contract at address ${address_CROWDSALE} is not deployed!`);
            return;
        }
    

       highloadWalletV3 = provider.open(
            HighloadWalletV3.createFromAddress(address_HLW)
            );

        // костыльное получение настоящего query, константу предполагается инкрементировать после каждого успешного запроса
        let curQuery = new HighloadQueryId();
        const goodCurQuery = 12
        for (let i = 0; i < goodCurQuery; ++i) {
            curQuery = curQuery.getNext()
        }

        let outMsgs: OutActionSendMsg[] = [];
        try {
        // fs.readFileSync('./list_bobuses.csv', 'utf8',  (err, fileAirdrop) => {
            const fileAirdrop = fs.readFileSync('./list_bobuses.csv', 'utf8');
            const rows =  fileAirdrop.split('|');
            for (let csvrow of  rows) {
                const rows = csvrow.split(',');
                const addrBon: Address = Address.parse(rows[0].toString());
                const bon: Bonus =  {$$type: 'Bonus', 
                                    to:addrBon,
                                    amount: BigInt(rows[1])};

                // функция с таким же названием как и раньше, однако её результат закладывается в ячейку с помощью storeRef
                function storeBonus(src: Bonus) {
                    let b_0 = new Builder();
                    b_0.storeUint(3122429960, 32);
                    b_0.storeAddress(src.to);
                    b_0.storeUint(src.amount, 32);

                    return b_0
                }

                const body = beginCell()
                    .storeRef(storeBonus(bon))
                    .endCell()

                outMsgs.push ({
                    type: 'sendMsg',
                    mode:  SendMode.IGNORE_ERRORS, // https://docs.ton.org/develop/smart-contracts/messages#message-modes - если интересно
                    outMsg: internal_relaxed({
                        to: address_CROWDSALE,
                        value: toNano('0.05'),
                        body: body
                    }),
                })
            }

            // из-за этих трёх красавцев была 500
            const goodSubWalletId = 0x10ad; // взято из официальных доков
            const goodTimeout = 60 * 60; // в секундах, отвечает за время "жизни" транзакции относительно createdAt, желательно менять в пределах от 1 до 24 часов
            const goodCreatedAt = Math.floor(Date.now() / 1000 - 100) // временная метка, являющаяся необязательным аргументом, но sendBatch как то плохо её генерирует
            /* последние два должны удовлетворять соотношениям
               created_at > now() - timeout;
               created_at <= now();
             (now() - текущее время у tvm)
             */

            const res = await highloadWalletV3.sendBatch(keyPair.secretKey, outMsgs, goodSubWalletId, curQuery, goodTimeout, goodCreatedAt);
            console.log (res);
            console.log('Next queryId: ' + (goodCurQuery + 1))
        }
        catch (err) {
            console.error(err);
          }
        // });
        // fs.createReadStream('./list_bobuses.csv')
        //     .pipe(parse({delimiter: ','}))
        //     .on('data', 
        //         function(csvrow:any) {
        //             // console.log(csvrow);   
        //             if (csvrow  !== null){                    
        //                     const addrBon: Address = Address.parse(csvrow[0].toString());
        //                     const bon: Bonus =  {$$type: 'Bonus', 
        //                                         to:addrBon,  
        //                                         amount: csvrow[1]};
        //                     outMsgs.push ({
        //                         type: 'sendMsg',
        //                         mode:  SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY, //comission 
        //                         outMsg: internal_relaxed({
        //                             to: address_CROWDSALE,
        //                             value: toNano('0.05'),
        //                             body: beginCell()
        //                                 .store(storeBonus(bon))
        //                                 .endCell()
        //                         }),
        //                     })
        //                 }
        //                 })
        //      .on('end', async function() {
        //                     //do something with csvData
        //         const res = await highloadWalletV3.sendBatch(keyPair.secretKey, outMsgs, SUBWALLET_ID, curQuery, DEFAULT_TIMEOUT*10, 1000);
        //         console.log (res);
        //                 }); 

        
        // expect(res.transactions).toHaveTransaction({
        //     on: highloadWalletV3.address,
        //     outMessagesCount: 254
        // });
        // for(let i = 0; i < 254; i++) {
        //     expect(res.transactions).toHaveTransaction({
        //         from: highloadWalletV3.address,
        //         body: outMsgs[i].outMsg.body
        //     })
        // }
        // expect(await highloadWalletV3.getProcessed(curQuery)).toBe(true);
        // console.log(highloadWalletV3.address)
        

    }
