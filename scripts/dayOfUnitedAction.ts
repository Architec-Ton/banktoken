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
import fs from 'node:fs';


export async function run(provider: NetworkProvider) {
    let bankers: any[] = [];

    let queryId = HighloadQueryId.fromShiftAndBitNumber(0n, 0n);
    const batchShift = 250;

    const totalWeight = 3n;
    const requireWeight = 3n;

    let key: DictionaryKey<Address>;
    let value: DictionaryValue<bigint>;
    const members = Dictionary.empty<Address, bigint>(key, value);

    const BNKjettonParams = {
        name: 'BNK jetton',
        description: 'BNK is a limited supply token that is the primary mining method for the official ARH token from the Arhitec.ton project.',
        symbol: 'BNK',
        image_data: 'UklGRtwCAABXRUJQVlA4TM8CAAAv/8A/AP9gpm2b8qfsSbnGgSDbZv60L8Hnf/7r0DeggB2AHSgOxc6hOOwUAA84FGBAoq09VeyAOBxkLpzKtFor5P3fc4xMXEl6N6L/Dty2cST5+ul6mczM7j4A1M/pP6f/nP5z+s8fQOqSn1PVm8mbl/iss/+wBomLRWF/Nz5r7e/o+votuq5+s66l/56uoU+ga+n3qa65a9UV9G2YX5/WPDTr6vmA5A1dNR/J27p6PomumU+oK+UT6/r4h+iq+IfpWvgH68r4dcp5quS6Hn59dJtv062Q68L6NB/SA8TXa6D+t1n73S9Tof4HilWafU/d0KydMS07Wt0Js/PUDU1tfyNJdS8KmbzGuJqm3MlrkVESOuoaYzWNmahrEVvl4EleXg6t3MgL0m9yMJCXlxb5kOYKc7f3RaLUozy2K1QVCrKvr21W41mKNusizzUJiBi3lN3Pgayaum0/ZrFJ29/Zcc9bDdzxyH+m7jbDo5Y8dyutB9KQaknd6W5WrAit8nNAL8WFYNGehJpMpjFZT8A3jieBoiy2iaIpkFsYQVXgs0VSCrKRN7eAHlBayIk+AWgMwI8xhhDHGUAPjsqfX3puUyGDPDMvH0j54FkEGaYNcjAaLpFr4qlyRZLFDwaeRBCE1XLEFZAkC8OdXUCWLB270wtIk/XG6kKbKkiUrynGreoiHr99vyKegBQQEQv21H3E02EvKM0V5IpvbBRyY6VcWhvQ7Tuc3yo2T/85KWMag/e2cQk8t513b12Azu9k+2wuHo/FnnoYi0Ss3rBKKOKQLb+FDoXhi3pLXZJsSEP3Bc+8YRkvCN8N00xykLiSBDofIosEgZa73xZQkdtS3hf91zv6TzhTSsiaUolJkLW4UnoKMOLWG+ZxRZQt7mo8+jYZNCqPvmUJyMy3uMwWOba+XC1/HCh/hX3yv6uh7xinvy2gfk7/Of3n9J/Tf/4IAQA=',
        decimals: '0'
    };
    const ARCjettonParams = {
        name: 'ARC jetton',
        description: 'ARC is the utility token released by the game launcher Architec.ton, based on the Telegram ecosystem. — ARC is the main token used inside games and the project\'s trading platform.',
        symbol: 'ARC',
        image_data: 'UklGRioDAABXRUJQVlA4TB0DAAAv/8A/AOdAIGnz/pU9rAZBts38aV+Cz//8R9+AAnYAdqA4ip2jOHYKgM5RfEABBmTZtt22zWMxrUpGAlVIYv4jjUHgvYd7PxnRf0hsJCmSoiKPS3Vchz3/SL8O/zn85/CfIxC28ObOoxHpVt68e/mvLqTvWE7yt5qR8ZCxkWR1gW5XK4li3PQdJKvGlWbXVVLFuOnRSHZx3MHv3S62M5azlFf35LlrpWAGw13LuGkZRLXGjdquZdz0aMSgflZeu5btjO0sdtU9aexayzteTHYt46ZlEBc1Au+S7CK5g0Mjjupnxb9rPczA/WUm5aaxEZfVvRHvWsZNyyCua4T7ZSbdGaGVCuq04ty1dGfMUk91GyaGipCAid+aeIF6TE33wOquJ7iaQ0XBZTVBZiXBZhWhbr/FiE/3QSjlbGFOWkHeM5wftjQ77xTBfc54Zt5E9vQfkRsWzrKv/8gFDRk6ziiYyNFxQJGl26DCuUMysPDtOaaCi1wdBhjZugsy8nUWaOwZU7oKUOSc1E0eAo4inSQIOsp0EngU6iL4KNVBAOLRKfVveg1CyrUOQhS0DUQ0tAxGVDTK0ghIdLRJKyhR0iYw0dIiOFFTP0DRUztIUVQ3UNFUM1hRVS9g0VUraFFWIVsvcNFWI3hRtzyA0bc0iDGwILEXyFiYn7NgxsT8gMbYkH4JUGNkXmBj5X6ughtDm2RGAY6Zy2dLBzl2xnSgo25msKNvVsBjYEbQY24Qvsh953+W4WN/hsQvfsz9NvDxIHpcCB4fYseJwJnEi8CP3jhXZ4PnRM5P60XkZw+F1oVLq0L3gXWouhO1ulDd0dfgZUN38Jh3h0+EV5ML9bpgzfDrbYsga24dqNKFboa9ZV0gm+xV64K2g83N7sLa5MUmRNS1TdZmdsGdYe/wjeBrbk09n+ZIoP6p3zEyutgWfePS+5LhDi677BbHHfxhdc097WN1iTcNa8wtkju4/3C/8GTzJHi56XaHsm+vic1QHsJzB3e7Q9jNKBxCsml/CN+a/tyx+8MFrk3lQzju4GaK1OsTtki/Dv85/Ofwn+MPIgA=',
        decimals: '9'
    };

    const fileAirdrop = fs.readFileSync('./all.csv', 'utf8');
    const rows =  fileAirdrop.split('\n');
    for (let csvrow of  rows) {
        const columns = csvrow.split(';');
        bankers.push({
            address: Address.parse(columns[0]),
            banksAmount: BigInt(columns[1])
        });
    }

    const nomises = new Set<string>()
    const fileNomis = fs.readFileSync('./nomis.txt', 'utf8');
    const nomis_rows =  fileNomis.split('\n');
    for (let csvrow of  nomis_rows) {
        const columns = csvrow.split(';');
        if (columns.length < 1) continue
        nomises.add(Address.parse(columns[0]).toString());
    }

    bankers = bankers.slice(0, 300)
    let teamBankers: any[] = [
        '0QAol9O-cZ0LFgCy-uBrdHp1LUfz4OQm1S4-TXeD_I-qVw-C',
        '0QChf2iEAzwAKtQi7FdDC8qupOAQAUQJCRUWK8lQ5IY9NFms',
        '0QAWUMflMSATPHsL2VsbpONhN9vffts9zBlosg6ja5n9dWwH',
        '0QDgv2MZMdFUUhCexa2cChGpqvCuhREawLDC_6ByfyI5_95e',
        '0QDOQbS74Sn-sGojYfUK6Uknlg8t1CdNjG-5VJx5VIO2zD_j',
        '0QCj0zI66mVKC_kkRZ-63e7uR9tcpHWxS-C-W-P_Xeroso3_',
        'UQBggNDfAxFW1ByH9qK0hWX3mwDA0MDCQnN15Yj8Q5skqg_z',
        'UQDanbhI__fcl6U36bD0knPt_S4376N4KrjuTNVLd6Fo769M',
        'EQDwkg9-g3zfIKztzDrWXuujayZJbyKv4BnUpZHPP17gN3TY',
        'EQCHZgSD3QcQA8JZs7oRot8xLd09mptvwX5WJVFma2JKgPPx',
        'UQBwswqpBw77xdsBDCMujvTGqCI7PFbnExdqttj5L-uaeYEv',
        'EQAol9O-cZ0LFgCy-uBrdHp1LUfz4OQm1S4-TXeD_I-qV-nN',
        '0QBrZnS1LBRQiHDrhTA_HLnTm3g1WFzDjpHbGzwz7Ht5GsOC',
        'EQBkhfpRLuJzD4zvONDeWTF-JSS2VVGL4XadmAdQfyctNbeD',
        'EQChG-UhynOlVvY90Qqn1DzsnV9evIJ0CX2G_4JR1PIlnXkv',
        'UQCx-cBejBZmBylzhpe2J5e5IesNwIymJIUHh5HVpj8_V-4H',
    ]

    for (let banker of teamBankers) {
        bankers.push({
            address: Address.parse(banker),
            banksAmount: 10000n
        })
    }

    let banksAirdropSum = 0n;
    for (let { banksAmount } of bankers) {
        banksAirdropSum += banksAmount;
    }
    const totalBanksOffset = banksAirdropSum + 300000n;

    const mnemonic = ['life', 'jump', 'setup', 'punch', 'enough', 'palace', 'submit', 'knock', 'crane', 'gloom', 'account', 'side', 'blush', 'debate', 'notice', 'isolate', 'census', 'sort', 'gas', 'civil', 'desk', 'stumble', 'search', 'battle'] //    process.env.HLW_WALLET_MNEMONIC!.split(' ')
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
        await sleep(2000);console.log('wait for processing')
    }
    await provider.waitForDeploy(multisig.address);
    await provider.waitForDeploy(arcJettonMaster.address);
    await provider.waitForDeploy(bankJettonMaster.address);
    await provider.waitForDeploy(banksCrowdSaleV3.address);
    queryId = queryId.getNext();
    console.log(queryId)

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
            value: toNano('0.07'),
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
            value: toNano('0.07'),
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

            let multi = 100n
            if (nomises.has(address.toString())) {
                multi = 110n
            }
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
                                amount: toNano(banksAmount * multi)
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
                        newMinter: bankJettonMaster.address,
                        isMinter: true
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
