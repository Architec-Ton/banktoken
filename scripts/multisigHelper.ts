import { Address, beginCell, Dictionary, DictionaryKey, DictionaryValue, toNano } from '@ton/core';
import '@ton/test-utils';
import { NetworkProvider } from '@ton/blueprint';

import 'dotenv/config';
import * as MS from '../build/Multisig/tact_Multisig';
import { MultisigSigner } from '../build/Multisig/tact_MultisigSigner';

import * as BJ from '../build/BankJetton/tact_BankJetton';
import * as BJW from '../build/BankJetton/tact_BankJettonWallet';
import * as AJW from '../build/ArcJetton/tact_ArcJettonWallet';
import * as CS from '../build/BanksCrowdSaleV3/tact_BanksCrowdSaleV3';

require('dotenv').config()

export async function run(provider: NetworkProvider, args: string[]) {
    const ui = provider.ui();

    const totalWeight = 3n;
    const requireWeight = 3n;

    let key: DictionaryKey<Address>;
    let value: DictionaryValue<bigint>;
    const members = Dictionary.empty<Address, bigint>(key, value);

    const owner1Address = Address.parse(process.env.OWNER_1_ADDRESS!);
    const owner2Address = Address.parse(process.env.OWNER_2_ADDRESS!);
    const owner3Address = Address.parse(process.env.OWNER_3_ADDRESS!);

    members.set(owner1Address, 1n);
    members.set(owner2Address, 1n);
    members.set(owner3Address, 1n);

    const multisig = provider.open(await MS.Multisig.fromInit(members, totalWeight, requireWeight));


    if (!(await provider.isContractDeployed(multisig.address))) {
        ui.write(`Error: Contract at address ${multisig.address} is not deployed!`);
        return;
    }

    let addressTo = Address.parse(process.env.ADDRESS_TO!);

    if (!(await provider.isContractDeployed(addressTo))) {
        ui.write(`Error: Contract at address ${addressTo} is not deployed!`);
        return;
    }

    try {
        const destinationAddress = addressTo
        const bankJettonTransfer: BJW.JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            destination: destinationAddress,
            response_destination: destinationAddress,
            amount: 0n,
            custom_payload: beginCell().endCell(),
            forward_ton_amount: 0n,
            forward_payload: beginCell().endCell()
        }
        const arcJettonTransfer: AJW.JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            destination: destinationAddress,
            response_destination: destinationAddress,
            amount: 0n,
            custom_payload: beginCell().endCell(),
            forward_ton_amount: 0n,
            forward_payload: beginCell().endCell()
        }
        const changeOwner: BJ.ChangeOwner = {
            $$type: 'ChangeOwner',
            queryId: 0n,
            newOwner: Address.parse('')
        }
        const setJettonWallet: CS.SetJettonWallet = {
            $$type: 'SetJettonWallet',
            jetton_wallet: Address.parse('')
        }

        const bodySimple = beginCell().endCell()
        const bodyBankJettonTransfer = beginCell().store(BJW.storeJettonTransfer(bankJettonTransfer)).endCell()
        const bodyArcJettonTransfer = beginCell().store(AJW.storeJettonTransfer(arcJettonTransfer)).endCell()
        const bodyChangeOwner = beginCell().store(BJ.storeChangeOwner(changeOwner)) // используется для ARC тоже
        const bodySetCrowdSaleWallet = beginCell().store(CS.storeSetJettonWallet(setJettonWallet)).endCell()

        const tonAmount = 1

        const request: MS.Request = {
            $$type: 'Request',
            requested: addressTo,
            to: addressTo,
            value: toNano(tonAmount),
            timeout: BigInt(Math.floor(Date.now() / 1000 + 60 * 60 * 24)),
            bounce: false,
            mode: 2n,
            body: bodySimple
        };
        const timestamp = BigInt(Math.floor(Date.now() / 1000));

        await multisig.send(
            provider.sender(),
            {
                value: toNano(0.05)
            },
            {
                $$type: 'CreatePoll',
                request: request,
                timestamp: timestamp
            }
        );

        const multisigSignerWallet = await MultisigSigner.fromInit(multisig.address, members, requireWeight, request, timestamp);
        ui.write(`MultisigSignerWallet: ${multisigSignerWallet.address}`)
    } catch (err) {
        console.error(err);
    }
}