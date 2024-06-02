import { Blockchain, EmulationError, SandboxContract, createShardAccount, internal } from '@ton/sandbox';
import { beginCell, Cell, SendMode, toNano, Address, internal as internal_relaxed, Dictionary, BitString, OutActionSendMsg } from '@ton/core';
import {HighloadWalletV3, TIMEOUT_SIZE, TIMESTAMP_SIZE} from '../wrappers/HighloadWalletV3';
import '@ton/test-utils';
import { getSecureRandomBytes, KeyPair, keyPairFromSeed } from "ton-crypto";
import { randomBytes } from "crypto";
import {SUBWALLET_ID, Errors, DEFAULT_TIMEOUT, maxKeyCount, maxShift} from "./imports/const";
import { compile } from '@ton/blueprint';
import { getRandomInt } from '../utils';
import { findTransactionRequired, randomAddress } from '@ton/test-utils';
import { MsgGenerator } from '../wrappers/MsgGenerator';
import {HighloadQueryId} from "../wrappers/HighloadQueryId";
import { BanksCrowdSaleV2 } from '../wrappers/BanksCrowdSaleV2';
import {Bonus, storeBonus} from '../build/BanksCrowdSaleV2/tact_BanksCrowdSaleV2';
import 'dotenv/config'
import fs from 'node:fs';

describe('HighloadWalletV3', () => {
    let keyPair: KeyPair;
    let code: Cell;

    let blockchain: Blockchain;
    let highloadWalletV3: SandboxContract<HighloadWalletV3>;

    let shouldRejectWith: (p: Promise<unknown>, code: number) => Promise<void>;
    let getContractData: (address: Address) => Promise<Cell>;
    let getContractCode: (address: Address) => Promise<Cell>;
    let banksCrowdSaleV2: SandboxContract<BanksCrowdSaleV2>;

    beforeAll(async () => {
        keyPair = keyPairFromSeed(await getSecureRandomBytes(32));
        code    = await compile('HighloadWalletV3');

        shouldRejectWith = async (p, code) => {
            try {
                await p;
                throw new Error(`Should throw ${code}`);
            }
            catch(e: unknown) {
                if(e instanceof EmulationError) {
                    expect(e.exitCode !== undefined && e.exitCode == code).toBe(true);
                }
                else {
                    throw e;
                }
            }
        }
        getContractData = async (address: Address) => {
          const smc = await blockchain.getContract(address);
          if(!smc.account.account)
            throw("Account not found")
          if(smc.account.account.storage.state.type != "active" )
            throw("Atempting to get data on inactive account");
          if(!smc.account.account.storage.state.state.data)
            throw("Data is not present");
          return smc.account.account.storage.state.state.data
        }
        getContractCode = async (address: Address) => {
          const smc = await blockchain.getContract(address);
          if(!smc.account.account)
            throw("Account not found")
          if(smc.account.account.storage.state.type != "active" )
            throw("Atempting to get code on inactive account");
          if(!smc.account.account.storage.state.state.code)
            throw("Code is not present");
          return smc.account.account.storage.state.state.code;
        }

    });

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;
        // blockchain.verbosity = {
        //     print: true,
        //     blockchainLogs: true,
        //     vmLogs: 'vm_logs',
        //     debugLogs: true,
        // }

        highloadWalletV3 = blockchain.openContract(
            HighloadWalletV3.createFromConfig(
                {
                    publicKey: keyPair.publicKey,
                    subwalletId: SUBWALLET_ID,
                    timeout: DEFAULT_TIMEOUT
                },
                code
            )
        );

        const deployer = await blockchain.treasury('deployer');

        let deployResult = await highloadWalletV3.sendDeploy(deployer.getSender(), toNano('999999'));

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: highloadWalletV3.address,
            deploy: true
        });

        banksCrowdSaleV2 = blockchain.openContract(await BanksCrowdSaleV2.fromInit());


         deployResult = await banksCrowdSaleV2.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: banksCrowdSaleV2.address,
            deploy: true,
            success: true,
        });
    });

    it('should handle 254 actions in one go', async () => {
        const curQuery = new HighloadQueryId();
        let outMsgs: OutActionSendMsg[] = []; 
        let rejects
        let res
        // try {
        // fs.readFileSync('./list_bobuses.csv', 'utf8',  (err, fileAirdrop) => {
            const fileAirdrop = fs.readFileSync('./list_bobuses.csv', 'utf8');
            const rows =  fileAirdrop.split('|');
            for (let csvrow of  rows) {
                const rows = csvrow.split(',');
                const addrBon: Address = Address.parse(rows[0].toString());
                const bon: Bonus =  {$$type: 'Bonus', 
                                    to:addrBon,  
                                    amount: BigInt(rows[1])};
                outMsgs.push ({
                    type: 'sendMsg',
                    mode:  /* SendMode.IGNORE_ERRORS + */ SendMode.PAY_GAS_SEPARATELY, //comission 
                    outMsg: internal_relaxed({
                        to: banksCrowdSaleV2.address,
                        value: toNano('0.05'),
                        body: beginCell()
                            .store(storeBonus(bon))
                            .endCell()
                    }),
                })
            } 
             res = await highloadWalletV3.sendBatch(keyPair.secretKey, outMsgs, SUBWALLET_ID, curQuery, DEFAULT_TIMEOUT*10, 1000);
            // console.log (res);
        // }
        // catch (err) {
        //     console.error(err);
        //   }
        expect(res.transactions).toHaveTransaction({
            on: highloadWalletV3.address,
            outMessagesCount: outMsgs.length
        });
        for(let i = 0; i < outMsgs.length; i++) {
            expect(res.transactions).toHaveTransaction({
                from: highloadWalletV3.address,
                body: outMsgs[i].outMsg.body
            })
        }
        expect(await highloadWalletV3.getProcessed(curQuery)).toBe(true);
    });
 
}); 
