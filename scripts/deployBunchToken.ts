import { Address, beginCell, Cell, Slice, toNano } from "ton";

import { BunchToken } from '../wrappers/BunchToken';
import { NetworkProvider } from '@ton/blueprint';
import {buildOnchainMetadata} from '../utils/jetton-helpers';

export async function run(provider: NetworkProvider) {
    let max_supply = 1_000_000n;
    let owner = Address.parse("UQAsB6vBUeSPdQ_XnIrTt8psWXpxdcJmCKVgyuDQYr8B2HQg");

    let content =  {
        name: "Bank",
        description: "Bank Token",
        symbol: "BNK",
        // decimals: 0,
        image: "https://www.architecton.site/bank.png",
        //image_data:""
     }
    const bunchToken = provider.open(await BunchToken.fromInit(
        buildOnchainMetadata( content), max_supply
        // owner: Address, 
        // content: Cell, 
        // max_supply: Int
        
        ));

    await bunchToken.send(
        provider.sender(),
        {
            value: 50_000_000n //toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(bunchToken.address);

    // console.log('ID', await bunchToken.getId());
    console.log('address',  bunchToken.address);
}
