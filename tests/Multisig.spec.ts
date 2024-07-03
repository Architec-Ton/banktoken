import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, Cell, Dictionary, DictionaryKey, DictionaryValue, toNano } from '@ton/core';
import '@ton/test-utils';
import { randomAddress } from '@ton/test-utils';
import { Multisig, Request } from '../build/Multisig/tact_Multisig';
import { MultisigSigner } from '../build/Multisig/tact_MultisigSigner';
import { BankJetton, JettonTransfer, storeJettonTransfer } from '../build/BankJetton/tact_BankJetton';
import { BankJettonWallet } from '../build/BankJetton/tact_BankJettonWallet';
import { ArcJetton, ChangeMinter, ChangeOwner, Mint, storeChangeOwner, storeMint } from '../build/ArcJetton/tact_ArcJetton';
import { ArcJettonWallet } from '../build/ArcJetton/tact_ArcJettonWallet';
import { storeChangeMinter } from '../wrappers/BankStaking';


describe('Multisig', () => {
    let blockchain: Blockchain;

    let owner1: SandboxContract<TreasuryContract>;
    let owner2: SandboxContract<TreasuryContract>;
    let owner3: SandboxContract<TreasuryContract>;

    const totalWeight = 3n;
    const requireWeight = 3n;

    let multisig: SandboxContract<Multisig>;
    let key: DictionaryKey<Address>;
    let value: DictionaryValue<bigint>;
    const members = Dictionary.empty<Address, bigint>(key, value);

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;

        owner1 = await blockchain.treasury('owner1');
        owner2 = await blockchain.treasury('owner2');
        owner3 = await blockchain.treasury('owner3');

        members.set(owner1.address, 1n);
        members.set(owner2.address, 1n);
        members.set(owner3.address, 1n);

        multisig = blockchain.openContract(await Multisig.fromInit(members, totalWeight, requireWeight));

        const deployer = await blockchain.treasury('deployer');

        const deployResult = await multisig.send(
            deployer.getSender(),
            {
                value: toNano(0.05)
            },
            {
                $$type: 'Deploy',
                queryId: 0n
            }
        );
        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: multisig.address,
            deploy: true
        });
    });

    it('should deploy', async () => {
        const multisig_members = await multisig.getMembers();

        expect(multisig_members.get(owner1.address)).toEqual(1n);
        expect(multisig_members.get(owner2.address)).toEqual(1n);
        expect(multisig_members.get(owner3.address)).toEqual(1n);
    });

    it('should create multi signed', async () => {
        const request: Request = {
            $$type: 'Request',
            requested: randomAddress(),
            to: randomAddress(),
            value: 1n,
            timeout: BigInt(blockchain.now + 100),
            bounce: false,
            mode: 2n,
            body: beginCell().endCell()
        };

        const requestTransaction = await multisig.send(
            owner1.getSender(),
            {
                value: toNano(0.05)
            },
            request
        );

        const multisigSignerWallet = await MultisigSigner.fromInit(multisig.address, members, requireWeight, request);
        const multisigSignerContract = blockchain.openContract(multisigSignerWallet);

        expect(requestTransaction.transactions).toHaveTransaction({
            from: owner1.address,
            to: multisig.address
        });

        expect(requestTransaction.transactions).toHaveTransaction({
            from: multisig.address,
            to: multisigSignerContract.address
        });
    });

    it('should transfer 1 TON to alice', async () => {
        const alice = await blockchain.treasury('alice');
        const aliceBalanceBefore = await alice.getBalance();

        const request: Request = {
            $$type: 'Request',
            requested: alice.address,
            to: alice.address,
            value: toNano(1),
            timeout: BigInt(blockchain.now + 100),
            bounce: false,
            mode: 2n,
            body: beginCell().endCell()
        };

        await multisig.send(
            owner1.getSender(),
            {
                value: toNano(2)
            },
            request
        );

        const multisigSignerWallet = await MultisigSigner.fromInit(multisig.address, members, requireWeight, request);
        const multisigSignerContract = blockchain.openContract(multisigSignerWallet);

        let yeses = [];
        for (let i of [owner1, owner2, owner3]) {
            const yesTransaction = await multisigSignerContract.send(
                i.getSender(),
                {
                    value: toNano(0.05)
                },
                'YES'
            );

            yeses.push(yesTransaction);
        }

        for (let i = 0, j = members.keys(); i < 3; ++i) {
            expect(yeses[i].transactions).toHaveTransaction({
                from: j[i],
                to: multisigSignerContract.address
            });
        }

        expect(yeses[2].transactions).toHaveTransaction({
            from: multisigSignerContract.address,
            to: multisig.address
        });

        expect(yeses[2].transactions).toHaveTransaction({
            from: multisig.address,
            to: alice.address
        });

        const aliceBalanceAfter = await alice.getBalance()
        expect(aliceBalanceBefore).toBeLessThan(aliceBalanceAfter)
    });

    it('should transfer 100 BNK to alice', async () => {
        const jetton_content: Cell = beginCell().endCell();
        const bankJettonContract = blockchain.openContract(await BankJetton.fromInit(owner2.address, jetton_content));

        await bankJettonContract.send(
            owner2.getSender(),
            {
                value: toNano('1'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        const owner2JettonWallet = await bankJettonContract.getGetWalletAddress(owner2.address);
        const owner2JettonContract = blockchain.openContract(BankJettonWallet.fromAddress(owner2JettonWallet))

        await owner2JettonContract.send(
            owner2.getSender(),
            {
                value: toNano(0.5)
            },
            {
                $$type: 'JettonTransfer',
                query_id: 0n,
                destination: multisig.address,
                response_destination: multisig.address,
                amount: 2000n,
                custom_payload: beginCell().endCell(),
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }
        )

        const multisigJettonWallet = await bankJettonContract.getGetWalletAddress(multisig.address);
        const multisigJettonContract = blockchain.openContract(BankJettonWallet.fromAddress(multisigJettonWallet))

        const alice = await blockchain.treasury('alice');

        const jettonTransfer: JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            destination: alice.address,
            response_destination: alice.address,
            amount: 100n,
            custom_payload: beginCell().endCell(),
            forward_ton_amount: 0n,
            forward_payload: beginCell().endCell()
        }

        const request: Request = {
            $$type: 'Request',
            requested: multisigJettonContract.address,
            to: multisigJettonContract.address,
            value: toNano(1),
            timeout: BigInt(blockchain.now + 100),
            bounce: true,
            mode: 2n,
            body: beginCell().store(storeJettonTransfer(jettonTransfer)).endCell()
        };

        await multisig.send(
            owner1.getSender(),
            {
                value: toNano(100)
            },
            request
        );

        const multisigSignerWallet = await MultisigSigner.fromInit(multisig.address, members, requireWeight, request);
        const multisigSignerContract = blockchain.openContract(multisigSignerWallet);
        for (let i of [owner1, owner2, owner3]) {
            await multisigSignerContract.send(
                i.getSender(),
                {
                    value: toNano(0.05)
                },
                'YES'
            );
        }

        const aliceJettonWallet = await bankJettonContract.getGetWalletAddress(alice.address)
        const aliceJettonContract = blockchain.openContract(BankJettonWallet.fromAddress(aliceJettonWallet))

        const aliceBalanceAfter = await aliceJettonContract.getGetWalletData()
        expect(aliceBalanceAfter.balance).toEqual(100n)
    });

    it('should transfer 100 ARC to alice', async () => {
        const jetton_content: Cell = beginCell().endCell();
        const arcJettonContract = blockchain.openContract(await ArcJetton.fromInit(owner2.address, jetton_content));

        await arcJettonContract.send(
            owner2.getSender(),
            {
                value: toNano('1'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        await arcJettonContract.send(
            owner2.getSender(),
            {
                value: toNano(0.5)
            },
            {
                $$type: 'Mint',
                to: multisig.address,
                amount: 2000n,
            }
        )

        const multisigJettonWallet = await arcJettonContract.getGetWalletAddress(multisig.address);
        const multisigJettonContract = blockchain.openContract(ArcJettonWallet.fromAddress(multisigJettonWallet))

        const alice = await blockchain.treasury('alice');

        const jettonTransfer: JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            destination: alice.address,
            response_destination: alice.address,
            amount: 100n,
            custom_payload: beginCell().endCell(),
            forward_ton_amount: 0n,
            forward_payload: beginCell().endCell()
        }

        const request: Request = {
            $$type: 'Request',
            requested: multisigJettonContract.address,
            to: multisigJettonContract.address,
            value: toNano(1),
            timeout: BigInt(blockchain.now + 100),
            bounce: true,
            mode: 2n,
            body: beginCell().store(storeJettonTransfer(jettonTransfer)).endCell()
        };

        await multisig.send(
            owner1.getSender(),
            {
                value: toNano(100)
            },
            request
        );

        const multisigSignerWallet = await MultisigSigner.fromInit(multisig.address, members, requireWeight, request);
        const multisigSignerContract = blockchain.openContract(multisigSignerWallet);
        for (let i of [owner1, owner2, owner3]) {
            await multisigSignerContract.send(
                i.getSender(),
                {
                    value: toNano(0.05)
                },
                'YES'
            );
        }

        const aliceJettonWallet = await arcJettonContract.getGetWalletAddress(alice.address)
        const aliceJettonContract = blockchain.openContract(ArcJettonWallet.fromAddress(aliceJettonWallet))

        const aliceBalanceAfter = await aliceJettonContract.getGetWalletData()
        expect(aliceBalanceAfter.balance).toEqual(100n)
    });

    it('should abort signed from alice', async () => {
        const request: Request = {
            $$type: 'Request',
            requested: randomAddress(),
            to: randomAddress(),
            value: 1n,
            timeout: BigInt(blockchain.now + 100),
            bounce: false,
            mode: 2n,
            body: beginCell().endCell()
        };

        const alice = await blockchain.treasury('alice');
        const requestTransaction = await multisig.send(
            alice.getSender(),
            {
                value: toNano(0.05)
            },
            request
        );

        expect(requestTransaction.transactions).toHaveTransaction({
            from: multisig.address,
            to: alice.address
        });
    });

    it('should abort YES from alice', async () => {
        const alice = await blockchain.treasury('alice');

        const request: Request = {
            $$type: 'Request',
            requested: alice.address,
            to: alice.address,
            value: toNano(1),
            timeout: BigInt(blockchain.now + 100),
            bounce: false,
            mode: 2n,
            body: beginCell().endCell()
        };

        await multisig.send(
            owner1.getSender(),
            {
                value: toNano(2)
            },
            request
        );

        const multisigSignerWallet = await MultisigSigner.fromInit(multisig.address, members, requireWeight, request);
        const multisigSignerContract = blockchain.openContract(multisigSignerWallet);

        let yeses = [];
        for (let i of [owner1, owner2, alice]) {
            const yesTransaction = await multisigSignerContract.send(
                i.getSender(),
                {
                    value: toNano(0.05)
                },
                'YES'
            );

            yeses.push(yesTransaction);
        }
        expect(yeses[2].transactions).toHaveTransaction({
            from: multisigSignerContract.address,
            to: alice.address
        })
    });

    it('should abort YES by timeout', async () => {
        const request: Request = {
            $$type: 'Request',
            requested: randomAddress(),
            to: randomAddress(),
            value: toNano(1),
            timeout: BigInt(blockchain.now + 100),
            bounce: false,
            mode: 2n,
            body: beginCell().endCell()
        };

        await multisig.send(
            owner1.getSender(),
            {
                value: toNano(2)
            },
            request
        );

        const multisigSignerWallet = await MultisigSigner.fromInit(multisig.address, members, requireWeight, request);
        const multisigSignerContract = blockchain.openContract(multisigSignerWallet);

        for (let i of [owner1, owner2, owner3]) {
            const yesTransaction = await multisigSignerContract.send(
                i.getSender(),
                {
                    value: toNano(0.05)
                },
                'YES'
            );
        }

        blockchain.now = 1000
        const abortedYes = await multisigSignerContract.send(
            owner3.getSender(),
            {
                value: toNano(0.05)
            },
            'YES'
        );
        expect(abortedYes.transactions).toHaveTransaction({
            from: multisigSignerContract.address,
            to: owner3.address
        })
    });


    it('should change ownership to Alice', async () => {
        const jetton_content: Cell = beginCell().endCell();
        const arcJettonContract = blockchain.openContract(await ArcJetton.fromInit(owner2.address, jetton_content));

        await arcJettonContract.send(
            owner2.getSender(),
            {
                value: toNano('1'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );


        await arcJettonContract.send(
            owner2.getSender(),
            {
                value: toNano(0.5)
            },
            {
                $$type: 'Mint',
                to: multisig.address,
                amount: 2000n,
            }
        )

        await arcJettonContract.send(
            owner2.getSender(),
            {
                value: toNano(0.5)
            },
            {
                $$type: 'ChangeOwner',
                newOwner: multisig.address,
                queryId:0n,
            }
        )

        const ownerBefore = await arcJettonContract.getOwner()
        expect(ownerBefore).toEqualAddress(multisig.address)

        const alice = await blockchain.treasury('alice');

        const changeOwner: ChangeOwner = {
            $$type: 'ChangeOwner',
            queryId: 0n,
            newOwner: alice.address,

        }

        const request: Request = {
            $$type: 'Request',
            requested: arcJettonContract.address,
            to: arcJettonContract.address,
            value: toNano(1),
            timeout: BigInt(blockchain.now + 100),
            bounce: true,
            mode: 2n,
            body: beginCell().store(storeChangeOwner(changeOwner)).endCell()
        };

        await multisig.send(
            owner1.getSender(),
            {
                value: toNano(100)
            },
            request
        );

        const multisigSignerWallet = await MultisigSigner.fromInit(multisig.address, members, requireWeight, request);
        const multisigSignerContract = blockchain.openContract(multisigSignerWallet);
        for (let i of [owner1, owner2, owner3]) {
            await multisigSignerContract.send(
                i.getSender(),
                {
                    value: toNano(0.05)
                },
                'YES'
            );
        }

        // const aliceJettonWallet = await arcJettonContract.getGetWalletAddress(alice.address)
        // const aliceJettonContract = blockchain.openContract(ArcJettonWallet.fromAddress(aliceJettonWallet))

        const ownerAfter = await arcJettonContract.getOwner()
        expect(ownerAfter).toEqualAddress(alice.address)
    });

    it('should change minter on ARC', async () => {
        const jetton_content: Cell = beginCell().endCell();
        const arcJettonContract = blockchain.openContract(await ArcJetton.fromInit(owner2.address, jetton_content));

        await arcJettonContract.send(
            owner2.getSender(),
            {
                value: toNano('1'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        const alice = await blockchain.treasury('alice');

        await arcJettonContract.send(
            owner2.getSender(),
            {
                value: toNano(0.5)
            },
            {
                $$type: 'Mint',
                to: alice.address,
                amount: 2000n,
            }
        )

        await arcJettonContract.send(
            owner2.getSender(),
            {
                value: toNano(0.5)
            },
            {
                $$type: 'ChangeMinter',
                newMinter: multisig.address,
             
            }
        )


        const mint: Mint = {
            $$type: 'Mint',
            to: alice.address,
            amount: 2000n,

        }

        const request: Request = {
            $$type: 'Request',
            requested: arcJettonContract.address,
            to: arcJettonContract.address,
            value: toNano(1),
            timeout: BigInt(blockchain.now + 100),
            bounce: true,
            mode: 2n,
            body: beginCell().store(storeMint(mint)).endCell()
        };

        await multisig.send(
            owner1.getSender(),
            {
                value: toNano(100)
            },
            request
        );

        const multisigSignerWallet = await MultisigSigner.fromInit(multisig.address, members, requireWeight, request);
        const multisigSignerContract = blockchain.openContract(multisigSignerWallet);
        for (let i of [owner1, owner2, owner3]) {
            await multisigSignerContract.send(
                i.getSender(),
                {
                    value: toNano(0.05)
                },
                'YES'
            );
        }

        const aliceJettonWallet = await arcJettonContract.getGetWalletAddress(alice.address)
        const aliceJettonContract = blockchain.openContract(ArcJettonWallet.fromAddress(aliceJettonWallet))
        const aliceBalanceAfter = await aliceJettonContract.getGetWalletData()
        expect(aliceBalanceAfter.balance).toEqual(4000n)

        const changeMinter: ChangeMinter = {
            $$type: 'ChangeMinter',
            newMinter: owner2.address,
        }

        const request2: Request = {
            $$type: 'Request',
            requested: arcJettonContract.address,
            to: arcJettonContract.address,
            value: toNano(1),
            timeout: BigInt(blockchain.now + 100),
            bounce: true,
            mode: 2n,
            body: beginCell().store(storeChangeMinter(changeMinter)).endCell()
        };

        await multisig.send(
            owner1.getSender(),
            {
                value: toNano(100)
            },
            request2
        );

        const multisigSignerWallet2 = await MultisigSigner.fromInit(multisig.address, members, requireWeight, request);
        const multisigSignerContract2 = blockchain.openContract(multisigSignerWallet2);
        for (let i of [owner1, owner2, owner3]) {
            await multisigSignerContract2.send(
                i.getSender(),
                {
                    value: toNano(0.05)
                },
                'YES'
            );
        }

        await arcJettonContract.send(
            owner2.getSender(),
            {
                value: toNano(0.5)
            },
            {
                $$type: 'Mint',
                to: alice.address,
                amount: 2000n,
            }
        )

        
        const aliceBalanceAfter2 = await aliceJettonContract.getGetWalletData()
        expect(aliceBalanceAfter.balance).toEqual(6000n)
    });
});
