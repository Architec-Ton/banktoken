import { mnemonicToPrivateKey } from 'ton-crypto';
import { compile, NetworkProvider } from '@ton/blueprint';
import { HighloadWalletV3 } from '../wrappers/HighloadWalletV3';
import { ARCjettonParams, BNKjettonParams, DEFAULT_TIMEOUT, SUBWALLET_ID } from './imports/const';
import { HighloadQueryId } from '../wrappers/HighloadQueryId';
import * as BJ from '../build/BankJetton/tact_BankJetton';
import { buildOnchainMetadata } from '../utils/jetton-helpers';
import * as BJW from '../build/BankJetton/tact_BankJettonWallet';
import * as AJ from '../build/ArcJetton/tact_ArcJetton';
import { HLWAirdrop } from '../utils/HLWv3-helpers';

export async function getHLW() {
    const mnemonic = process.env.WALLET_MNEMONIC!.split(' ')//process.env.HLW_WALLET_MNEMONIC!.split(' ');
    const keyPair = await mnemonicToPrivateKey(mnemonic);
    const code = await compile('HighloadWalletV3');

    const HighloadWallet = HighloadWalletV3.createFromConfig(
        {
            publicKey: keyPair.publicKey,
            subwalletId: SUBWALLET_ID,
            timeout: DEFAULT_TIMEOUT
        },
        code
    )

    return {keyPair, HighloadWallet}
}

export async function Airdrop(provider: NetworkProvider, queryId: HighloadQueryId, filename: string, amount=0n) {
    const {keyPair, HighloadWallet} = await getHLW()

    const highloadWalletV3 = provider.open(HighloadWallet);

    const bankJettonMaster = provider.open(await BJ.BankJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(BNKjettonParams)));
    const highloadWalletV3BankJettonWallet = await bankJettonMaster.getGetWalletAddress(highloadWalletV3.address);
    const highloadWalletV3BankJettonContract = provider.open(BJW.BankJettonWallet.fromAddress(highloadWalletV3BankJettonWallet));

    const arcJettonMaster = provider.open(await AJ.ArcJetton.fromInit(highloadWalletV3.address, buildOnchainMetadata(ARCjettonParams)));

    await HLWAirdrop(highloadWalletV3, keyPair, queryId, highloadWalletV3BankJettonContract, arcJettonMaster, filename, amount);
}
