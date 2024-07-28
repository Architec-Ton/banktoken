import { beginCell, OutActionSendMsg, SendMode, toNano } from '@ton/core';
import '@ton/test-utils';
import { NetworkProvider, sleep } from '@ton/blueprint';
import { ARCjettonParams, BNKjettonParams } from './imports/const';

import { HLWSend } from '../utils/HLWv3-helpers';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { internal as internal_relaxed } from '@ton/core/dist/types/_helpers';
import { buildOnchainMetadata } from '../utils/jetton-helpers';

import * as MS from '../build/Multisig/tact_Multisig';
import * as BJ from '../build/BankJetton/tact_BankJetton';
import * as AJ from '../build/ArcJetton/tact_ArcJetton';
import * as CS from '../build/BanksCrowdSaleV3/tact_BanksCrowdSaleV3';
import { members } from './multisigMembers';
import { getHLW } from './highloadWallet';


export async function run(provider: NetworkProvider) {
    let queryId = HighloadQueryId.fromShiftAndBitNumber(0n, 0n);
    const {keyPair, HighloadWallet} = await getHLW()

    const highloadWalletV3 = provider.open(HighloadWallet);

    await highloadWalletV3.sendDeploy(provider.sender(), toNano('30')); // сколько TON
    while (!(await provider.isContractDeployed(highloadWalletV3.address))) {
        await sleep(2000);
        console.log('wait for deploy');
    }

    const multisig = provider.open(await MS.Multisig.fromInit(members, 3n, 3n));
    const multisigDeploy: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: multisig.address,
            value: toNano('0.05'),
            init: multisig.init,
            body: beginCell().store(MS.storeDeploy({
                $$type: 'Deploy',
                queryId: 0n
            })).endCell()
        })
    };

    const bankJettonMaster = provider.open(await BJ.BankJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(BNKjettonParams)));
    const bankDeploy: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: bankJettonMaster.address,
            value: toNano('0.5'),
            init: bankJettonMaster.init,
            body: beginCell().store(BJ.storeDeploy({
                $$type: 'Deploy',
                queryId: 0n
            })).endCell()
        })
    };

    const arcJettonMaster = provider.open(await AJ.ArcJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(ARCjettonParams)));
    const arcDeploy: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: arcJettonMaster.address,
            value: toNano('0.05'),
            init: arcJettonMaster.init,
            body: beginCell().store(AJ.storeDeploy({
                $$type: 'Deploy',
                queryId: 0n
            })).endCell()
        })
    };

    const banksCrowdSaleV3 = provider.open(await CS.BanksCrowdSaleV3.fromInit(bankJettonMaster.address));
    const banksCrowdSaleV3Deploy: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: banksCrowdSaleV3.address,
            value: toNano('0.05'),
            init: banksCrowdSaleV3.init,
            body: beginCell().store(CS.storeDeploy({
                $$type: 'Deploy',
                queryId: 0n
            })).endCell()
        })
    };

    let outMsgs: OutActionSendMsg[] = [multisigDeploy, arcDeploy, bankDeploy, banksCrowdSaleV3Deploy];

    let createdAt = Math.floor(Date.now() / 1000 - 100);
    await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId, createdAt);
    while (!highloadWalletV3.getProcessed(queryId)) {
        await sleep(2000);
        console.log('wait for processing');
    }
    await provider.waitForDeploy(multisig.address);
    await provider.waitForDeploy(arcJettonMaster.address);
    await provider.waitForDeploy(bankJettonMaster.address);
    await provider.waitForDeploy(banksCrowdSaleV3.address);
    queryId = queryId.getNext();
    console.log(queryId);

    console.log(
        highloadWalletV3.address,
        multisig.address,
        bankJettonMaster.address,
        arcJettonMaster.address,
        banksCrowdSaleV3.address
    );
}