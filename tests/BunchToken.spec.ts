import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { Address, beginCell, Cell, Slice, toNano } from "@ton/core";

// import { toNano } from '@ton/core';
import { BunchToken } from '../wrappers/BunchToken';
import '@ton/test-utils';
import {jettonMinterInitData} from '../scripts/jetton-minter.deploy'

describe('BunchToken', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let bunchToken: SandboxContract<BunchToken>;
    let max_supply = 1000000;
    let owner = Address.parse("UQAsB6vBUeSPdQ_XnIrTt8psWXpxdcJmCKVgyuDQYr8B2HQg");

    let content =  {
        name: "Bank",
        description: "Bank Token",
        symbol: "BNK",
        decimals: 0,
        image: "https://www.architecton.site/bank.png",
        //image_data:""
     }

    beforeEach(async () => {
        blockchain = await Blockchain.create();

        bunchToken = blockchain.openContract(await BunchToken.fromInit(        
            jettonMinterInitData(owner, content),
             max_supply));

        deployer = await blockchain.treasury('deployer');

        const deployResult = await bunchToken.send(
            deployer.getSender(),
            {
                value: toNano('0.05'),
            },
            {
                $$type: 'Deploy',
                queryId: 0n,
            }
        );

        expect(deployResult.transactions).toHaveTransaction({
            from: deployer.address,
            to: bunchToken.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and bunchToken are ready to use
    });

    it('should increase counter', async () => {
        const increaseTimes = 3;
        for (let i = 0; i < increaseTimes; i++) {
            console.log(`increase ${i + 1}/${increaseTimes}`);

            const increaser = await blockchain.treasury('increaser' + i);

            const counterBefore = await bunchToken.getCounter();

            console.log('counter before increasing', counterBefore);

            const increaseBy = BigInt(Math.floor(Math.random() * 100));

            console.log('increasing by', increaseBy);

            const increaseResult = await bunchToken.send(
                increaser.getSender(),
                {
                    value: toNano('0.05'),
                },
                {
                    $$type: 'Add',
                    queryId: 0n,
                    amount: increaseBy,
                }
            );

            expect(increaseResult.transactions).toHaveTransaction({
                from: increaser.address,
                to: bunchToken.address,
                success: true,
            });

            const counterAfter = await bunchToken.getCounter();

            console.log('counter after increasing', counterAfter);

            expect(counterAfter).toBe(counterBefore + increaseBy);
        }
    });
});
