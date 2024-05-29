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
    
        keyPair = await  mnemonicToPrivateKey(process.env.WALLET_MNEMONIC!.split(' '));
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

       highloadWalletV3 = provider.open(
            HighloadWalletV3.createFromConfig(
                {
                    publicKey: keyPair.publicKey,
                    subwalletId: SUBWALLET_ID,
                    timeout: DEFAULT_TIMEOUT
                },
                code
            )
        );

        await highloadWalletV3.sendDeploy(
            provider.sender(),
            toNano('0.05'),
            // {
            //     value: toNano('0.05'),
            // },
            // // {
            //     $$type: 'Deploy',
            //     queryId: 0n,
            // },
        );

       console.log(highloadWalletV3.address)
       await provider.waitForDeploy(highloadWalletV3.address);

    }
