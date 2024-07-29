import { Address, beginCell, OutActionSendMsg, SendMode } from '@ton/core';
import '@ton/test-utils';
import { NetworkProvider } from '@ton/blueprint';

import { HLWSend } from '../utils/HLWv3-helpers';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { internal as internal_relaxed } from '@ton/core/dist/types/_helpers';
import { getHLW } from './highloadWallet';
import * as BJ from '../build/BankJetton/tact_BankJetton';
import { buildOnchainMetadata } from '../utils/jetton-helpers';
import { ARCjettonParams, BNKjettonParams } from './imports/const';
import * as AJ from '../build/ArcJetton/tact_ArcJetton';
import * as CS from '../build/BanksCrowdSaleV3/tact_BanksCrowdSaleV3';
import * as BJW from '../build/BankJetton/tact_BankJettonWallet';
import { toNano } from '@ton/core';
import { getMultisig } from './multisigMembers';
import * as MS from '../build/Multisig/tact_Multisig';


export async function run(provider: NetworkProvider) {
    let queryId = HighloadQueryId.fromShiftAndBitNumber(1n, 1n);
    const { keyPair, HighloadWallet } = await getHLW();

    const highloadWalletV3 = provider.open(HighloadWallet);

    const bankJettonMaster = provider.open(await BJ.BankJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(BNKjettonParams)));

    const banksCrowdSaleV3 = provider.open(await CS.BanksCrowdSaleV3.fromAddress(Address.parse('kQCGPhwK3XWC32jQ3neY2_TFQP6UxHybUz_5cN3_ufScxBHr')));

    const members = getMultisig();
    const multisig = provider.open(await MS.Multisig.fromInit(members, 3n, 3n));

    const changeCrowdSaleOwnerMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: banksCrowdSaleV3.address,
            value: toNano('0.05'),
            body:
                beginCell()
                    .store(CS.storeChangeOwner({
                        $$type: 'ChangeOwner',
                        queryId: 0n,
                        newOwner: Address.parse('kQCILmBSe0EXI6dKyuvBFlmviCURyvb4_4iT4TCGzMNbu1Rf')
                    }))
                    .endCell()
        })
    };

    // const returnCoins: OutActionSendMsg = {
    //     type: 'sendMsg',
    //     mode: SendMode.CARRY_ALL_REMAINING_BALANCE,
    //     outMsg: internal_relaxed({
    //         to: ownerAddress,
    //         value: 0n,
    //         body: beginCell().endCell()
    //     })
    // };

    let outMsgs = [changeCrowdSaleOwnerMsg];
    queryId = await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId);
}