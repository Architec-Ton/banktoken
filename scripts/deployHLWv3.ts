import { Blockchain, EmulationError } from '@ton/sandbox';
import { Address, Cell, toNano } from '@ton/core';
import { HighloadWalletV3 } from '../wrappers/HighloadWalletV3';
import '@ton/test-utils';
import { KeyPair, mnemonicToPrivateKey } from 'ton-crypto';
import { DEFAULT_TIMEOUT, SUBWALLET_ID } from './imports/const';
import { compile, NetworkProvider } from '@ton/blueprint';

import 'dotenv/config';


let keyPair: KeyPair;
let code: Cell;

let blockchain: Blockchain;
let highloadWalletV3: any; // OpenedContract<HighloadWalletV3>

let shouldRejectWith: (p: Promise<unknown>, code: number) => Promise<void>;
let getContractData: (address: Address) => Promise<Cell>;
let getContractCode: (address: Address) => Promise<Cell>;
require('dotenv').config();

export async function run(provider: NetworkProvider, args: string[]) {

    // beforeAll(async () => {

    keyPair = await mnemonicToPrivateKey(process.env.WALLET_MNEMONIC!.split(' '));
    code = await compile('HighloadWalletV3');

    shouldRejectWith = async (p, code) => {
        try {
            await p;
            throw new Error(`Should throw ${code}`);
        } catch (e: unknown) {
            if (e instanceof EmulationError) {
                expect(e.exitCode !== undefined && e.exitCode == code).toBe(true);
            } else {
                throw e;
            }
        }
    };

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
        toNano('0.05')
    );

    console.log(highloadWalletV3.address);
    await provider.waitForDeploy(highloadWalletV3.address);
}