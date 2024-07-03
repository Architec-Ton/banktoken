import {
    Address,
    beginCell,
    Dictionary,
    DictionaryKey,
    DictionaryValue,
    OutActionSendMsg,
    SendMode,
    toNano
} from '@ton/core';
import '@ton/test-utils';
import { randomAddress } from '@ton/test-utils';

import { mnemonicToPrivateKey } from 'ton-crypto';
import { compile, NetworkProvider, sleep } from '@ton/blueprint';
import { HighloadWalletV3 } from '../wrappers/HighloadWalletV3';
import { DEFAULT_TIMEOUT, SUBWALLET_ID } from './imports/const';

import { HLWSend } from '../utils/HLWv3-helpers';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import { internal as internal_relaxed } from '@ton/core/dist/types/_helpers';
import { buildOnchainMetadata, getJettonTransferBuilder } from '../utils/jetton-helpers';

import * as MS from '../build/Multisig/tact_Multisig';
import * as BJ from '../build/BankJetton/tact_BankJetton';
import * as BJW from '../build/BankJetton/tact_BankJettonWallet';
import * as AJ from '../build/ArcJetton/tact_ArcJetton';
import * as CS from '../build/BanksCrowdSaleV3/tact_BanksCrowdSaleV3';


export async function run(provider: NetworkProvider) {
    let bankers: any[] = [];

    let queryId = HighloadQueryId.fromShiftAndBitNumber(0n, 0n);
    const batchShift = 100;

    const totalWeight = 3n;
    const requireWeight = 3n;

    let key: DictionaryKey<Address>;
    let value: DictionaryValue<bigint>;
    const members = Dictionary.empty<Address, bigint>(key, value);

    const BNKjettonParams = {
        name: 'BNK jetton',
        description: 'BNK is a limited supply token that is the primary mining method for the official ARH token from the Arhitec.ton project.',
        symbol: 'BNK',
        image: 'https://www.com/BNKjetton.json',
        decimals: '0'
    };
    const ARCjettonParams = {
        name: 'ARC jetton',
        description: 'ARC is the utility token released by the game launcher Architec.ton, based on the Telegram ecosystem. — ARC is the main token used inside games and the project\'s trading platform.',
        symbol: 'ARC',
        image: 'https://www.com/ARCjetton.json',
        decimals: '9'
    };

    for (let i = 0; i < 150; ++i) {
        bankers.push({
            address: randomAddress(),
            banksAmount: BigInt(54)
        });
    }

    let banksAirdropSum = 0n;
    for (let { banksAmount } of bankers) {
        banksAirdropSum += banksAmount;
    }
    const totalBanksOffset = banksAirdropSum + 300000n;

    const mnemonic = process.env.WALLET_MNEMONIC!.split(' ');
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const code = await compile('HighloadWalletV3');

    const highloadWalletV3 = provider.open(
        HighloadWalletV3.createFromConfig(
            {
                publicKey: keyPair.publicKey,
                subwalletId: SUBWALLET_ID,
                timeout: DEFAULT_TIMEOUT
            },
            code
        )
    );

    await highloadWalletV3.sendDeploy(provider.sender(), toNano('30')); // сколько TON
    while (!(await provider.isContractDeployed(highloadWalletV3.address))) {
        await sleep(2000);
        console.log('wait for deploy')
    }

    const owner1Address = Address.parse(process.env.OWNER_1_ADDRESS!);
    const owner2Address = Address.parse(process.env.OWNER_2_ADDRESS!);
    const owner3Address = Address.parse(process.env.OWNER_3_ADDRESS!);

    members.set(owner1Address, 1n);
    members.set(owner2Address, 1n);
    members.set(owner3Address, 1n);

    const multisig = provider.open(await MS.Multisig.fromInit(members, totalWeight, requireWeight));
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

    const banksCrowdSaleV3 = provider.open(await CS.BanksCrowdSaleV3.fromInit());
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
        await sleep(2000);console.log('wait for processing')
    }
    await provider.waitForDeploy(multisig.address);
    await provider.waitForDeploy(arcJettonMaster.address);
    await provider.waitForDeploy(bankJettonMaster.address);
    await provider.waitForDeploy(banksCrowdSaleV3.address);
    queryId = queryId.getNext();
    console.log(queryId)

    // check contracts on active
    await multisig.getMembers();
    await bankJettonMaster.getGetJettonData();
    await arcJettonMaster.getGetJettonData();
    await banksCrowdSaleV3.getOwner();

    const highloadWalletV3BankJettonWallet = await bankJettonMaster.getGetWalletAddress(highloadWalletV3.address);
    const highloadWalletV3BankJettonContract = provider.open(BJW.BankJettonWallet.fromAddress(highloadWalletV3BankJettonWallet));

    const bankTransferToCrowdSale: BJW.JettonTransfer = {
        $$type: 'JettonTransfer',
        query_id: 0n,
        amount: 2700000n - banksAirdropSum,
        destination: banksCrowdSaleV3.address,
        response_destination: banksCrowdSaleV3.address,
        custom_payload: beginCell().endCell(),
        forward_ton_amount: 0n,
        forward_payload: beginCell().endCell()
    };

    const bankTransferToCrowdsaleMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: highloadWalletV3BankJettonContract.address,
            value: toNano('0.5'),
            body: beginCell().store(BJW.storeJettonTransfer(bankTransferToCrowdSale)).endCell()
        })
    };

    const bankTransferToMultisig: BJW.JettonTransfer = {
        $$type: 'JettonTransfer',
        query_id: 0n,
        amount: 300000n,
        destination: multisig.address,
        response_destination: multisig.address,
        custom_payload: beginCell().endCell(),
        forward_ton_amount: 0n,
        forward_payload: beginCell().endCell()
    };

    const bankTransferToMultisigMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: highloadWalletV3BankJettonContract.address,
            value: toNano('0.5'),
            body: beginCell().store(BJW.storeJettonTransfer(bankTransferToMultisig)).endCell()
        })
    };

    const banksCrowdSaleV3Wallet = await bankJettonMaster.getGetWalletAddress(banksCrowdSaleV3.address);
    const banksCrowdSaleV3JettonContract = provider.open(BJW.BankJettonWallet.fromAddress(banksCrowdSaleV3Wallet));

    const setBanksCrowdSaleV3JettonWallet: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: banksCrowdSaleV3.address,
            value: toNano('0.05'),
            init: banksCrowdSaleV3.init,
            body: beginCell().store(CS.storeSetJettonWallet({
                $$type: 'SetJettonWallet',
                jetton_wallet: banksCrowdSaleV3JettonContract.address
            })).endCell()
        })
    };

    const setBankOffset: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: banksCrowdSaleV3.address,
            value: toNano('0.05'),
            init: banksCrowdSaleV3.init,
            body: beginCell().store(CS.storeSetBankOffset({
                $$type: 'SetBankOffset',
                offset: totalBanksOffset
            })).endCell()
        })
    };

    outMsgs = [setBankOffset, bankTransferToCrowdsaleMsg, bankTransferToMultisigMsg, setBanksCrowdSaleV3JettonWallet];
    createdAt = Math.floor(Date.now() / 1000 - 100);
    await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId, createdAt);
    while (!highloadWalletV3.getProcessed(queryId)) {
        await sleep(2000);console.log('wait for processing')
    }
    queryId = queryId.getNext();
    console.log(queryId)

    for (let i = 0; i < bankers.length / batchShift; ++i) {
        const outMsgsBanks: OutActionSendMsg[] = [];
        const outMsgsArcs: OutActionSendMsg[] = [];
        const current_recipients = bankers.slice(batchShift * i, batchShift * (i + 1));

        for (let { address, banksAmount } of current_recipients) {
            outMsgsBanks.push({
                type: 'sendMsg',
                mode: SendMode.IGNORE_ERRORS,
                outMsg: internal_relaxed({
                    to: highloadWalletV3BankJettonContract.address,
                    value: toNano('0.07'),
                    body:
                        beginCell()
                            .store(BJ.storeJettonTransfer(getJettonTransferBuilder(address, banksAmount, highloadWalletV3.address, false)))
                            .endCell()
                })
            });

            outMsgsArcs.push({
                type: 'sendMsg',
                mode: SendMode.IGNORE_ERRORS,
                outMsg: internal_relaxed({
                    to: arcJettonMaster.address,
                    value: toNano('0.07'),
                    body:
                        beginCell()
                            .store(AJ.storeMint({
                                $$type: 'Mint',
                                to: address,
                                amount: toNano(banksAmount * 100n)
                            }))
                            .endCell()
                })
            });
        }

        createdAt = Math.floor(Date.now() / 1000 - 100);
        await HLWSend(highloadWalletV3, keyPair, outMsgsBanks, queryId, createdAt);
        while (!highloadWalletV3.getProcessed(queryId)) {
            await sleep(2000);console.log('wait for processing')
        }
        queryId = queryId.getNext();
        console.log(queryId)

        createdAt = Math.floor(Date.now() / 1000 - 100);
        await HLWSend(highloadWalletV3, keyPair, outMsgsArcs, queryId, createdAt);
        while (!highloadWalletV3.getProcessed(queryId)) {
            await sleep(2000);console.log('wait for processing')
        }
        queryId = queryId.getNext();
        console.log(queryId)
    }

    const changeBankOwnerMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: bankJettonMaster.address,
            value: toNano('0.05'),
            body:
                beginCell()
                    .store(BJ.storeChangeOwner({
                        $$type: 'ChangeOwner',
                        queryId: 0n,
                        newOwner: multisig.address
                    }))
                    .endCell()
        })
    };

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
                        newOwner: multisig.address
                    }))
                    .endCell()
        })
    };

    const changeArcOwnerMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: arcJettonMaster.address,
            value: toNano('0.05'),
            body:
                beginCell()
                    .store(AJ.storeChangeOwner({
                        $$type: 'ChangeOwner',
                        queryId: 0n,
                        newOwner: multisig.address
                    }))
                    .endCell()
        })
    };

    const changeArcMinterMsg: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: arcJettonMaster.address,
            value: toNano('0.05'),
            body:
                beginCell()
                    .store(AJ.storeChangeMinter({
                        $$type: 'ChangeMinter',
                        newMinter: bankJettonMaster.address
                    }))
                    .endCell()
        })
    };

    const addJettonAddress: OutActionSendMsg = {
        type: 'sendMsg',
        mode: SendMode.IGNORE_ERRORS,
        outMsg: internal_relaxed({
            to: bankJettonMaster.address,
            value: toNano('0.05'),
            body:
                beginCell()
                    .store(BJ.storeAddingJettonAddress({
                        $$type: 'AddingJettonAddress',
                        this_contract_jettonWallet: arcJettonMaster.address
                    }))
                    .endCell()
        })
    };

    outMsgs = [addJettonAddress, changeArcMinterMsg, changeCrowdSaleOwnerMsg, changeBankOwnerMsg, changeArcOwnerMsg];
    createdAt = Math.floor(Date.now() / 1000 - 100);
    await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId, createdAt);
    while (!highloadWalletV3.getProcessed(queryId)) {
        await sleep(2000);console.log('wait for processing')
    }
    queryId = queryId.getNext();

    console.log(
        mnemonic,
        multisig.address,
        bankJettonMaster.address,
        arcJettonMaster.address,
        banksCrowdSaleV3.address,
        queryId
    );
}
