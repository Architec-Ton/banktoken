import { beginCell, toNano } from '@ton/core';
import { BankJetton } from '../wrappers/BankJetton';
import { NetworkProvider } from '@ton/blueprint';
import { buildOnchainMetadata } from '../utils/jetton-helpers';
import { BankJettonWallet } from '../build/BankJetton/tact_BankJettonWallet';
import { BanksCrowdSaleV3 } from '../build/BanksCrowdSaleV3/tact_BanksCrowdSaleV3';

export async function run(provider: NetworkProvider) {
    const BNKjettonParams = {
        name: 'BNK jetton',
        description: 'This is description for test BNK jetton',
        symbol: 'BNK',
        image: 'https://www.com/BNKjetton.json',
    };

    const ownerAddress = provider.sender().address

    const bankJetton = provider.open(await BankJetton.fromInit(ownerAddress, buildOnchainMetadata(BNKjettonParams)));
    await bankJetton.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        },
    );

    await provider.waitForDeploy(bankJetton.address);

    const banksCrowdSaleV3 = provider.open(await BanksCrowdSaleV3.fromInit());
    await banksCrowdSaleV3.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        },
    );

    await provider.waitForDeploy(banksCrowdSaleV3.address);

    const banksCrowdSaleV3Wallet = await bankJetton.getGetWalletAddress(banksCrowdSaleV3.address)
    const banksCrowdSaleV3JettonContract = provider.open(BankJettonWallet.fromAddress(banksCrowdSaleV3Wallet));

    await banksCrowdSaleV3.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'SetJettonWallet',
            jetton_wallet: banksCrowdSaleV3JettonContract.address,
        }
    )

    const ownerJettonWallet = await bankJetton.getGetWalletAddress(ownerAddress)
    const ownerJettonContract = provider.open(BankJettonWallet.fromAddress(ownerJettonWallet))
    await bankJetton.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'JettonMint',
            origin: ownerAddress,
            receiver: ownerAddress,
            amount: toNano(3000000),
            custom_payload: beginCell().endCell(),
            forward_ton_amount: 0n,
            forward_payload: beginCell().endCell(),
        },
    );

    await ownerJettonContract.send(
        provider.sender(),
        {
            value: toNano('0.5'),
        },
        {
            $$type: 'JettonTransfer',
            query_id: 0n,
            amount: toNano(2800000),
            destination: banksCrowdSaleV3.address,
            response_destination: banksCrowdSaleV3.address,
            custom_payload: beginCell().endCell(),
            forward_ton_amount: 0n,
            forward_payload: beginCell().endCell(),
        }
    );

    console.log('JettonMaster: ', bankJetton.address,
        '\nCrowdSaleV3: ', banksCrowdSaleV3.address,)
}
