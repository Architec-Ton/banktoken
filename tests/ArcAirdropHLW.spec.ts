import {Blockchain, SandboxContract, TreasuryContract} from '@ton/sandbox';
import {beginCell, Cell, OutActionSendMsg, SendMode, toNano} from '@ton/core';
import {ArcJetton, JettonMint, storeJettonMint} from '../build/ArcJetton/tact_ArcJetton';
import {ArcJettonWallet} from '../build/ArcJetton/tact_ArcJettonWallet';
import '@ton/test-utils';
import {buildOnchainMetadata} from "../utils/jetton-helpers";
import {HighloadQueryId} from "../wrappers/HighloadQueryId";
import {internal as internal_relaxed} from "@ton/core/dist/types/_helpers";
import {randomAddress} from "@ton/test-utils";
import {DEFAULT_TIMEOUT, SUBWALLET_ID} from "./imports/const";
import {getSecureRandomBytes, KeyPair, keyPairFromSeed} from "ton-crypto";
import {HighloadWalletV3} from "../wrappers/HighloadWalletV3";
import {compile} from "@ton/blueprint";

describe('ARC Airdrop test', () => {
    let keyPair: KeyPair;
    let code: Cell;
    let blockchain: Blockchain;
    let highloadWalletV3: SandboxContract<HighloadWalletV3>;

    let owner: SandboxContract<TreasuryContract>;
    let ARCJetton: SandboxContract<ArcJetton>;
    const jettonParams = {
        name: "ARC jetton",
        description: "This is description for ARC jetton",
        symbol: "ARC",
        image: "https://www.com/ARCjetton.png"
    };

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        blockchain.now = 1000;
        keyPair = keyPairFromSeed(await getSecureRandomBytes(32));
        code    = await compile('HighloadWalletV3');

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
        const deployer = await blockchain.treasury('deployer');

        const deployHLWResult = await highloadWalletV3.sendDeploy(deployer.getSender(), toNano('999999'));

        expect(deployHLWResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: highloadWalletV3.address,
            deploy: true
        });

        owner = await blockchain.treasury('owner', {balance: toNano(2)});
        ARCJetton = blockchain.openContract(await ArcJetton.fromInit(owner.address, buildOnchainMetadata(jettonParams)));
        const deployJettonResult = await ARCJetton.send(
            owner.getSender(),
            {
                value: toNano('1'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            },
        );

        expect(deployJettonResult.transactions).toHaveTransaction({
            from: owner.address,
            to: ARCJetton.address,
            deploy: true,
            success: true,
        });
    });


    it('should airdrop to 254 addresses', async () => {
        const curQuery = new HighloadQueryId();

        const num = 254
        const amount = 100n

        let holdersAddresses = Array(num)
        let outMsgs: OutActionSendMsg[] = new Array(num);

        for(let i = 0; i < num; i++) {
            holdersAddresses[i] = randomAddress()

            const src: JettonMint = {
                $$type: 'JettonMint',
                origin: holdersAddresses[i],
                receiver: holdersAddresses[i],
                amount: toNano(amount),
                custom_payload: null,
                forward_ton_amount: 0n,
                forward_payload: beginCell().endCell()
            }

            outMsgs[i] = {
                type: 'sendMsg',
                mode: SendMode.NONE,
                outMsg: internal_relaxed({
                    to: ARCJetton.address,
                    value: toNano('1'),
                    body:
                        beginCell()
                        .store(storeJettonMint(src))
                        .endCell()
                }),
            }
        }

        const res = await highloadWalletV3.sendBatch(keyPair.secretKey, outMsgs, SUBWALLET_ID, curQuery, DEFAULT_TIMEOUT, 1000);

        expect(res.transactions).toHaveTransaction({
            on: highloadWalletV3.address,
            outMessagesCount: num
        });

        for (let i = 0; i < num; i++) {
            expect(res.transactions).toHaveTransaction({
                from: highloadWalletV3.address,
                to: ARCJetton.address,
                body: outMsgs[i].outMsg.body
            })

            // Check that ARCJetton send amount token to Alice's jetton wallet
            const aliceWalletAddress = await ARCJetton.getGetWalletAddress(holdersAddresses[i]);
            expect(res.transactions).toHaveTransaction({
                from: ARCJetton.address,
                to: aliceWalletAddress,
                success: true,
            });

            const aliceJettonContract = blockchain.openContract(ArcJettonWallet.fromAddress(aliceWalletAddress));
            const aliceBalanceAfter = (await aliceJettonContract.getGetWalletData()).balance;
            expect(aliceBalanceAfter).toEqual(toNano(amount));
        }

        expect(await highloadWalletV3.getProcessed(curQuery)).toBe(true);

        const jettonData = await ARCJetton.getGetJettonData()
        expect(jettonData.total_supply).toEqual(toNano(BigInt(num) * amount))
    });
});
