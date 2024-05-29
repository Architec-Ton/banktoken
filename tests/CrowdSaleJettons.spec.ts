import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { CrowdSaleJettons } from '../wrappers/CrowdSaleJettons';
import { BunchToken } from '../wrappers/BunchToken';
import '@ton/test-utils';
import {buildOnchainMetadata} from '../utils/jetton-helpers';

describe('CrowdSaleJettons', () => {
    let blockchain: Blockchain;
    let deployer: SandboxContract<TreasuryContract>;
    let crowdSaleJettons: SandboxContract<CrowdSaleJettons>;
    let bankJetton: SandboxContract<BunchToken>;
    let max_supply = 1_000_000n;
    let content =  {
        name: "Bank",
        description: "Bank Token",
        symbol: "BNK",
        // decimals: 0,
        image: "https://www.architecton.site/bank.png",
        //image_data:""
     }

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        deployer = await blockchain.treasury('deployer');

        crowdSaleJettons = blockchain.openContract(await CrowdSaleJettons.fromInit());

        bankJetton = blockchain.openContract(await BunchToken.fromInit(
            buildOnchainMetadata( content), max_supply
            // owner: Address, 
            // content: Cell, 
            // max_supply: Int
            
            ));

        let deployResult = await bankJetton.send(
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
                to: bankJetton.address,
                deploy: true,
                success: true,
            });
            
        deployResult = await crowdSaleJettons.send(
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
            to: crowdSaleJettons.address,
            deploy: true,
            success: true,
        });
        
    });

    it('should deploy', async () => {
        // the check is done inside beforeEach
        // blockchain and crowdSaleJettons are ready to use
    });
});
