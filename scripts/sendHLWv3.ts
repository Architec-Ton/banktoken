import { Blockchain, EmulationError, SandboxContract, createShardAccount, internal } from '@ton/sandbox';
import { beginCell, Cell, SendMode, toNano, Address, internal as internal_relaxed, Dictionary, BitString, OutActionSendMsg } from '@ton/core';
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
import * as fs  from  'fs';
// import { env } from  'node:process';
import 'dotenv/config'


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

    // beforeAll(async () => {
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
        
        const curQuery = new HighloadQueryId();
        let outMsgs: OutActionSendMsg[] = []; 

        fs.createReadStream('./list_bobuses.csv')
            .pipe(parse({delimiter: ','}))
            .on('data', function(csvrow:any) {
            // console.log(csvrow);
            const addrBon: Address = Address.parse(csvrow[0].toString());
            const bon: Bonus =  {$$type: 'Bonus', 
                                to:addrBon,  
                                amount: csvrow[1]};
            outMsgs.push ({
                type: 'sendMsg',
                mode:  SendMode.IGNORE_ERRORS + SendMode.PAY_GAS_SEPARATELY, //comission 
                outMsg: internal_relaxed({
                    to: address_CROWDSALE,
                    value: toNano('0.05'),
                    body: beginCell()
                        .store(storeBonus(bon))
                        .endCell()
                }),
            })
        });

        const res = await highloadWalletV3.sendBatch(keyPair.secretKey, outMsgs, SUBWALLET_ID, curQuery, DEFAULT_TIMEOUT*10, 1000);
        
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
