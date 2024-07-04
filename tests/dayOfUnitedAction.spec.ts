import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import {
    Address,
    beginCell, Cell,
    Dictionary,
    DictionaryKey,
    DictionaryValue,
    OutActionSendMsg,
    SendMode,
    toNano
} from '@ton/core';
import '@ton/test-utils';
import { randomAddress } from '@ton/test-utils';
import { randomInt } from 'crypto';

import { KeyPair, mnemonicNew, mnemonicToPrivateKey } from 'ton-crypto';
import { compile } from '@ton/blueprint';
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
import * as AJW from '../build/ArcJetton/tact_ArcJettonWallet';
import * as CS from '../build/BanksCrowdSaleV3/tact_BanksCrowdSaleV3';
import { BankJettonWallet } from '../build/BankJetton/tact_BankJettonWallet';
import { Multisig } from '../build/Multisig/tact_Multisig';
import { StakeStorage } from '../build/StakeStorage/tact_StakeStorage';


describe('Independence Day', () => {
    let blockchain: Blockchain;
    let bankers: any[] = [];

    let keyPair: KeyPair;
    let code: Cell;
    let highloadWalletV3: SandboxContract<HighloadWalletV3>;
    let queryId = new HighloadQueryId;
    const batchShift = 250;

    let owner1: SandboxContract<TreasuryContract>;
    let owner2: SandboxContract<TreasuryContract>;
    let owner3: SandboxContract<TreasuryContract>;

    const totalWeight = 3n;
    const requireWeight = 3n;

    let key: DictionaryKey<Address>;
    let value: DictionaryValue<bigint>;
    const members = Dictionary.empty<Address, bigint>(key, value);

    let multisig: SandboxContract<Multisig>;

    const BNKjettonParams = {
        name: 'BNK jetton',
        description: 'This is description for BNK jetton',
        symbol: 'BNK',
        image: 'https://www.com/BNKjetton.json',
        decimals: '0'
    };
    const ARCjettonParams = {
        name: 'ARC jetton',
        description: 'This is description for ARC jetton',
        symbol: 'ARC',
        image: 'https://www.com/ARCjetton.json',
        decimals: '9'
    };

    let bankJettonMaster: SandboxContract<BJ.BankJetton>;
    let arcJettonMaster: SandboxContract<AJ.ArcJetton>;
    let banksCrowdSaleV3: SandboxContract<CS.BanksCrowdSaleV3>;

    let totalBanksOffset: bigint;

    let highloadWalletV3BankJettonContract: SandboxContract<BJW.BankJettonWallet>;
    let highloadWalletV3ArcJettonContract: SandboxContract<AJW.ArcJettonWallet>;

    let banksCrowdSaleV3JettonContract: SandboxContract<BJW.BankJettonWallet>;
    let multisigBankJettonContract: SandboxContract<BJW.BankJettonWallet>;

    beforeAll(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;

        for (let i = 0; i < 300; ++i) {
            bankers.push({
                contract: await blockchain.treasury('banker' + i.toString()),
                banksAmount: BigInt(randomInt(10, 100))
            });
        }

        let banksAirdropSum = 0n;
        for (let { banksAmount } of bankers) {
            banksAirdropSum += banksAmount;
        }
        totalBanksOffset = banksAirdropSum + 300000n

        const deployer = await blockchain.treasury('deployer');

        const mnemonic = await mnemonicNew();
        console.log(mnemonic)
        keyPair = await mnemonicToPrivateKey(mnemonic);
        code = await compile('HighloadWalletV3');

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

        const deployResult = await highloadWalletV3.sendDeploy(deployer.getSender(), toNano('99999'));
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: highloadWalletV3.address,
            deploy: true
        });

        owner1 = await blockchain.treasury('owner1');
        owner2 = await blockchain.treasury('owner2');
        owner3 = await blockchain.treasury('owner3');

        members.set(owner1.address, 1n);
        members.set(owner2.address, 1n);
        members.set(owner3.address, 1n);

        multisig = blockchain.openContract(await MS.Multisig.fromInit(members, totalWeight, requireWeight));
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

        bankJettonMaster = blockchain.openContract(await BJ.BankJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(BNKjettonParams)));
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

        arcJettonMaster = blockchain.openContract(await AJ.ArcJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(ARCjettonParams)));
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

        banksCrowdSaleV3 = blockchain.openContract(await CS.BanksCrowdSaleV3.fromInit());
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

        await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId, blockchain.now - 100);
        queryId = queryId.getNext();
        blockchain.now += DEFAULT_TIMEOUT;

        // check contracts on active
        await multisig.getMembers();
        await bankJettonMaster.getGetJettonData();
        await arcJettonMaster.getGetJettonData();
        await banksCrowdSaleV3.getOwner();

        const highloadWalletV3BankJettonWallet = await bankJettonMaster.getGetWalletAddress(highloadWalletV3.address);
        highloadWalletV3BankJettonContract = blockchain.openContract(BJW.BankJettonWallet.fromAddress(highloadWalletV3BankJettonWallet));

        const highloadWalletV3ArcJettonWallet = await arcJettonMaster.getGetWalletAddress(highloadWalletV3.address);
        highloadWalletV3ArcJettonContract = blockchain.openContract(AJW.ArcJettonWallet.fromAddress(highloadWalletV3ArcJettonWallet));

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
        banksCrowdSaleV3JettonContract = blockchain.openContract(BJW.BankJettonWallet.fromAddress(banksCrowdSaleV3Wallet));

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
        }

        outMsgs = [setBankOffset, bankTransferToCrowdsaleMsg, bankTransferToMultisigMsg, setBanksCrowdSaleV3JettonWallet];
        await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId, blockchain.now - 100);
        queryId = queryId.getNext();
        blockchain.now += DEFAULT_TIMEOUT;

        // check jetton amount in multisig and crowdSale
        const multisigBankJettonWallet = await bankJettonMaster.getGetWalletAddress(multisig.address);
        multisigBankJettonContract = blockchain.openContract(BJW.BankJettonWallet.fromAddress(multisigBankJettonWallet));
        const multisigBankJettonWalletData = await multisigBankJettonContract.getGetWalletData();
        expect(multisigBankJettonWalletData.balance).toEqual(300000n);

        const banksCrowdSaleV3BankJettonWalletData = await banksCrowdSaleV3JettonContract.getGetWalletData();
        expect(banksCrowdSaleV3BankJettonWalletData.balance).toEqual(2700000n - banksAirdropSum);

        for (let i = 0; i < bankers.length / batchShift; ++i) {
            const outMsgsBanks: OutActionSendMsg[] = [];
            const outMsgsArcs: OutActionSendMsg[] = [];
            const current_recipients = bankers.slice(batchShift * i, batchShift * (i + 1));

            for (let { contract, banksAmount } of current_recipients) {
                outMsgsBanks.push({
                    type: 'sendMsg',
                    mode: SendMode.IGNORE_ERRORS,
                    outMsg: internal_relaxed({
                        to: highloadWalletV3BankJettonContract.address,
                        value: toNano('0.07'),
                        body:
                            beginCell()
                                .store(BJ.storeJettonTransfer(getJettonTransferBuilder(contract.address, banksAmount, highloadWalletV3.address, false)))
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
                                    to: contract.address,
                                    amount: toNano(banksAmount * 100n)
                                }))
                                .endCell()
                    })
                });
            }

            await HLWSend(highloadWalletV3, keyPair, outMsgsBanks, queryId, blockchain.now - 100);
            blockchain.now += DEFAULT_TIMEOUT;
            queryId = queryId.getNext();

            await HLWSend(highloadWalletV3, keyPair, outMsgsArcs, queryId, blockchain.now - 100);
            blockchain.now += DEFAULT_TIMEOUT;
            queryId = queryId.getNext();
        }

        // check result of airdrop
        for (let { contract, banksAmount } of bankers) {
            {
                const bankWallet = await bankJettonMaster.getGetWalletAddress(contract.address);
                const bankContract = blockchain.openContract(BJW.BankJettonWallet.fromAddress(bankWallet));
                const bankBalanceAfter = (await bankContract.getGetWalletData()).balance;
                expect(bankBalanceAfter).toEqual(banksAmount);
            }

            {
                const arcWallet = await arcJettonMaster.getGetWalletAddress(contract.address);
                const arcContract = blockchain.openContract(AJW.ArcJettonWallet.fromAddress(arcWallet));
                const arcBalanceAfter = (await arcContract.getGetWalletData()).balance;
                expect(arcBalanceAfter).toEqual(toNano(banksAmount * 100n));
            }
        }

        const changeBankOwnerMsg: OutActionSendMsg = {
            type: 'sendMsg',
            mode: SendMode.IGNORE_ERRORS,
            outMsg: internal_relaxed({
                to: bankJettonMaster.address,
                value: toNano('1'),
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
                value: toNano('0.1'),
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
        await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId, blockchain.now - 100);
        queryId = queryId.getNext();
        blockchain.now += DEFAULT_TIMEOUT;

        // check new owners
        expect((await bankJettonMaster.getOwner()).toString()).toEqual(multisig.address.toString());
        expect((await banksCrowdSaleV3.getOwner()).toString()).toEqual(multisig.address.toString());
        expect((await arcJettonMaster.getOwner()).toString()).toEqual(multisig.address.toString());

    }, 10000000);

    it('Check all preparations', async () => {}, 10000000);

    it('Check crowdSale', async () => {
        const banksAmount = 10;

        let randoms = [];
        for (let i = 0; i < 100; ++i) {
            randoms.push(await blockchain.treasury(i.toString(), {balance: toNano(100 * 1.6)}))
            await banksCrowdSaleV3.send(
                randoms.at(-1).getSender(),
                {
                    value: toNano(banksAmount * 1.5 + 1),
                },
                i % 2 == 0? null : "buyBank"
            )
        }

        for (let rnd of randoms) {
            const rndWallet = await bankJettonMaster.getGetWalletAddress(rnd.address)
            const rndContract = blockchain.openContract(BankJettonWallet.fromAddress(rndWallet))
            const balance = (await rndContract.getGetWalletData()).balance

            expect(balance).toEqual(BigInt(banksAmount));
        }

        expect(await banksCrowdSaleV3.getTotalBanks()).toEqual(totalBanksOffset + BigInt(banksAmount * 100))

        let randomsRef = [];
        for (let i = 0; i < 100; ++i) {
            randomsRef.push(await blockchain.treasury(i.toString()+'r', {balance: toNano(100 * 1.6)}))
            await banksCrowdSaleV3.send(
                randomsRef.at(-1).getSender(),
                {
                    value: toNano(banksAmount * 1.5 + 1),
                },
                {
                    $$type: 'ReferralAddress',
                    referral: randoms[i].address
                }
            )
        }

        for (let i = 0; i < 100; ++i) {
            {
                const rndWallet = await bankJettonMaster.getGetWalletAddress(randoms[i].address);
                const rndContract = blockchain.openContract(BankJettonWallet.fromAddress(rndWallet));
                const balance = (await rndContract.getGetWalletData()).balance;

                expect(balance).toEqual(BigInt(banksAmount * 2));
            }

            {
                const rndWalletRef = await bankJettonMaster.getGetWalletAddress(randomsRef[i].address);
                const rndContractRef = blockchain.openContract(BankJettonWallet.fromAddress(rndWalletRef));
                const balanceRef = (await rndContractRef.getGetWalletData()).balance;

                expect(balanceRef).toEqual(BigInt(banksAmount));
            }
        }

        expect(await banksCrowdSaleV3.getTotalBanks()).toEqual(totalBanksOffset + BigInt(banksAmount * 300))
    }, 10000000)

    it('Check bankStaking', async () => {
        const alice: SandboxContract<TreasuryContract> = blockchain.openContract(bankers[0].contract)

        const aliceBankWalletAddress = await bankJettonMaster.getGetWalletAddress(alice.address);
        const aliceBankJettonContract = blockchain.openContract(BJW.BankJettonWallet.fromAddress(aliceBankWalletAddress));

        const aliceArcWalletAddress = await arcJettonMaster.getGetWalletAddress(alice.address);
        const aliceArcJettonContract = blockchain.openContract(AJW.ArcJettonWallet.fromAddress(aliceArcWalletAddress));

        const aliceArcBalanceBefore = (await aliceArcJettonContract.getGetWalletData()).balance;

        const jettonTransfer: BJW.Stake = {
            $$type: 'Stake',
            query_id: 0n,
            amount: 10n,
        };

        await aliceBankJettonContract.send(
            alice.getSender(),
            {
                value: toNano('10'),
            },
            jettonTransfer,
        );

        blockchain.now += 60*60*24*300; // 300 days gone
        const exspct= (toNano("3.3"));

        await bankJettonMaster.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            "Unstake"
        );

        // Check that Alice's ARC jetton wallet balance is 3.3N
        const aliceARCBalanceAfter = (await aliceArcJettonContract.getGetWalletData()).balance;
        expect(aliceARCBalanceAfter - aliceArcBalanceBefore).toEqual(exspct);

        const aliceBnkBalanceAfter = (await aliceBankJettonContract.getGetWalletData()).balance;
        expect(aliceBnkBalanceAfter).toBeGreaterThanOrEqual(10n);
    }, 10000000)

    it('check one else bankAirdrop', async () => {
        const recipients = []
        for (let i = 0; i < 100; i++) {
            recipients.push({
                address: randomAddress()
            })
        }

        const bueOneBankForAllHolders: OutActionSendMsg = {
            type: 'sendMsg',
            mode: SendMode.IGNORE_ERRORS,
            outMsg: internal_relaxed({
                to: banksCrowdSaleV3.address,
                value: toNano(1.5 * recipients.length + 0.05),
                body: beginCell().endCell()
            })
        };
        await HLWSend(highloadWalletV3, keyPair, [bueOneBankForAllHolders], queryId, blockchain.now - 100)
        queryId = queryId.getNext();
        blockchain.now += DEFAULT_TIMEOUT;

        for (let i = 0; i < recipients.length / batchShift; ++i) {
            const outMsgs: OutActionSendMsg[] = [];
            const current_recipients = recipients.slice(batchShift * i, batchShift * (i + 1));

            for (let { address } of current_recipients) {
                outMsgs.push({
                    type: 'sendMsg',
                    mode: SendMode.IGNORE_ERRORS,
                    outMsg: internal_relaxed({
                        to: highloadWalletV3BankJettonContract.address,
                        value: toNano('0.5'),
                        body:
                            beginCell()
                                .store(BJ.storeJettonTransfer(getJettonTransferBuilder(address, 1n, highloadWalletV3.address, false)))
                                .endCell()
                    })
                });
            }

            await HLWSend(highloadWalletV3, keyPair, outMsgs, queryId, blockchain.now - 100);
            blockchain.now += DEFAULT_TIMEOUT;
            queryId = queryId.getNext();
        }

        // check result of airdrop
        for (let { address } of recipients) {
            const bankWallet = await bankJettonMaster.getGetWalletAddress(address);
            const bankContract = blockchain.openContract(BJW.BankJettonWallet.fromAddress(bankWallet));
            const bankBalanceAfter = (await bankContract.getGetWalletData()).balance;
            expect(bankBalanceAfter).toEqual(1n);
        }

        const higlhloadWalletV3BankJettonBalance = (await highloadWalletV3BankJettonContract.getGetWalletData()).balance
        expect(higlhloadWalletV3BankJettonBalance).toEqual(0n)
    }, 10000000)

    it('check multisig work', async () => {

    }, 10000000)
});
