import { Blockchain, SandboxContract, TreasuryContract, printTransactionFees } from '@ton/sandbox';
//'@ton-community/sandbox';
import { Cell, beginCell, toNano, BitReader } from '@ton/core';
// import { ExampleNFTCollection, RoyaltyParams } from '../wrappers/NFTExample_ExampleNFTCollection';
import { ArcJetton, JettonBurn } from '../build/ArcJetton/tact_ArcJetton';
// wrappers/JettonExample_ArcJetton';
import { ArcJettonWallet, JettonTransfer } from '../build/ArcJetton/tact_ArcJettonWallet';
//../wrappers/JettonExample_ArcJettonWallet';
// import '@ton-community/test-utils';
import '@ton/test-utils';
import { buildOnchainMetadata } from '../utils/jetton-helpers';
import { isObject } from 'node:util';
import { deserialize } from 'node:v8';
import { deserializeBoc } from '@ton/core/dist/boc/cell/serialization';
import { parseDict } from '@ton/core/dist/dict/parseDict';
import { base64Decode } from '@ton/sandbox/dist/utils/base64';
import { sha256 } from '@ton/crypto';

describe('ARC jetton test', () => {
    let blockchain: Blockchain;
    let owner: SandboxContract<TreasuryContract>;
    let alice: SandboxContract<TreasuryContract>;
    let ARCJetton: SandboxContract<ArcJetton>;
    const jettonParams = {
        name: 'ARC jetton',
        description: 'This is description for ARC jetton',
        symbol: 'ARC',
        image: 'https://www.com/ARCjetton.png',
    };

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        owner = await blockchain.treasury('owner');
        alice = await blockchain.treasury('alice');
        // const jetton_content: Cell = beginCell().endCell();
        ARCJetton = blockchain.openContract(
            await ArcJetton.fromInit(owner.address, buildOnchainMetadata(jettonParams)),
        );
        const deployResult = await ARCJetton.send(
            owner.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: owner.address,
            to: ARCJetton.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and nFTCollection are ready to use
    });

    it('should mint 1 token to Alice', async () => {
        // Mint 1 token to Alice
        const mintyResult = await ARCJetton.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );
        //printTransactionFees(mintyResult.transactions);

        // Check that Alice send "Mint:1" msg to ARCJetton
        expect(mintyResult.transactions).toHaveTransaction({
            from: alice.address,
            to: ARCJetton.address,
            success: true,
        });

        // Check that ARCJetton send 1 token to Alice's jetton wallet
        const aliceWalletAddress = await ARCJetton.getGetWalletAddress(alice.address);
        expect(mintyResult.transactions).toHaveTransaction({
            from: ARCJetton.address,
            to: aliceWalletAddress,
            success: true,
        });

        // Check that Alice's jetton wallet send JettonExcesses msg to Alice
        expect(mintyResult.transactions).toHaveTransaction({
            from: aliceWalletAddress,
            to: alice.address,
            success: true,
        });

        // Check that Alice's jetton wallet balance is 1
        const aliceJettonContract = blockchain.openContract(await ArcJettonWallet.fromAddress(aliceWalletAddress));
        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(0n + 1000000000n);
    });

    it('should Alice send 1 token to Bob', async () => {
        // Mint 1 token to Alice first to build her jetton wallet
        await ARCJetton.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );
        // Alice's jetton wallet address
        const aliceWalletAddress = await ARCJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await ArcJettonWallet.fromAddress(aliceWalletAddress));

        // Mint 1 token to Bob first to build his jetton wallet
        const bob = await blockchain.treasury('bob');
        const mintyResult = await ARCJetton.send(
            bob.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );
        // Bob's jetton wallet address
        const bobWalletAddress = await ARCJetton.getGetWalletAddress(bob.address);
        // Bob's jetton wallet
        const bobJettonContract = blockchain.openContract(await ArcJettonWallet.fromAddress(bobWalletAddress));
        const bobBalanceBefore = (await bobJettonContract.getGetWalletData()).balance;

        // Alice transfer 1 token to Bob
        const jettonTransfer: JettonTransfer = {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: 1n,
            destination: bob.address,
            response_destination: bob.address,
            custom_payload: null,
            forward_ton_amount: 0n,
            forward_payload: beginCell().endCell(),
        };
        const transferResult = await aliceJettonContract.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            jettonTransfer,
        );
        //printTransactionFees(transferResult.transactions);

        // Check that Alice send JettonTransfer msg to her jetton wallet
        expect(transferResult.transactions).toHaveTransaction({
            from: alice.address,
            to: aliceWalletAddress,
            success: true,
        });

        // Check that Alice's jetton wallet send JettonInternalTransfer msg to Bob's jetton wallet
        expect(transferResult.transactions).toHaveTransaction({
            from: aliceWalletAddress,
            to: bobWalletAddress,
            success: true,
        });

        // Check that Bob's jetton wallet send JettonExcesses msg to Bob
        expect(transferResult.transactions).toHaveTransaction({
            from: bobWalletAddress,
            to: bob.address,
            success: true,
        });

        // Check that Bob's jetton wallet balance is added 1
        const bobBalanceAfter = (await bobJettonContract.getGetWalletData()).balance;
        expect(bobBalanceAfter).toEqual(bobBalanceBefore + 1n);
    });

    it('should Alice burn 1 token', async () => {
        // Mint 1 token to Alice first to build her jetton wallet
        const mintyResult = await ARCJetton.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            'Mint:1',
        );

        const jettonBurn: JettonBurn = {
            $$type: 'JettonBurn',
            query_id: 0n,
            amount: 1n,
            response_destination: alice.address,
            custom_payload: null,
        };

        // Alice's jetton wallet address
        const aliceWalletAddress = await ARCJetton.getGetWalletAddress(alice.address);
        // Alice's jetton wallet
        const aliceJettonContract = blockchain.openContract(await ArcJettonWallet.fromAddress(aliceWalletAddress));
        // Alice's jetton wallet balance before burning
        const aliceBalanceBefore = (await aliceJettonContract.getGetWalletData()).balance;

        // Alice burn 1 token
        const burnResult = await aliceJettonContract.send(
            alice.getSender(),
            {
                value: toNano('1'),
            },
            jettonBurn,
        );
        //printTransactionFees(burnResult.transactions);

        // Check that Alice send JettonBurn msg to her jetton wallet
        expect(burnResult.transactions).toHaveTransaction({
            from: alice.address,
            to: aliceWalletAddress,
            success: true,
        });

        // Check that Alice's jetton wallet send JettonBurnNotification msg to ARCJetton
        expect(burnResult.transactions).toHaveTransaction({
            from: aliceWalletAddress,
            to: ARCJetton.address,
            success: true,
        });

        // Check that ARCJetton send JettonExcesses msg to Alice
        expect(burnResult.transactions).toHaveTransaction({
            from: ARCJetton.address,
            to: alice.address,
            success: true,
        });

        // Check that Alice's jetton wallet balance is subtracted 1
        const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
        expect(aliceBalanceAfter).toEqual(aliceBalanceBefore - 1n);
    });

    it('get token data ', async () => {
        const getKeys = async () => {
            const metadataKeys = new Map<bigint, string>();
            const metadata = ['name', 'description', 'symbol', 'image'];

            for (let i of metadata) {
                const sha256View = await sha256(i);
                let b = 0n,
                    c = 1n << 248n;
                for (let byte of sha256View) {
                    b += BigInt(byte) * c;
                    c /= 256n;
                }
                metadataKeys.set(b, i);
            }

            return metadataKeys;
        };

        const jettondata = await ARCJetton.getGetJettonData();

        let totalSupply = jettondata.total_supply;
        let mintable = jettondata.mintable;
        let adminAddress = jettondata.admin_address;
        let cellJettonContent = jettondata.jetton_content;
        let jettonWalletCode = jettondata.jetton_wallet_code;

        const hasMap = parseDict(cellJettonContent.refs[0].beginParse(), 256, (src) => src);
        const deserializeHashMap = new Map<string, string>();
        const metadataKeys = await getKeys();

        for (let [intKey, stringKey] of metadataKeys) {
            const value = hasMap.get(intKey).loadStringTail().split('\x00')[1];
            deserializeHashMap.set(stringKey, value);
        }

        const jettonContent = {
            name: deserializeHashMap.get('name'),
            description: deserializeHashMap.get('description'),
            symbol: deserializeHashMap.get('symbol'),
            image: deserializeHashMap.get('image'),
        };

        expect(jettonContent).toEqual(jettonParams);
    });
});
