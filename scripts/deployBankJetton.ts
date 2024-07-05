import { toNano } from '@ton/core';
import { BankJetton } from '../wrappers/BankJetton';
import { NetworkProvider } from '@ton/blueprint';
import fs from 'node:fs';
import * as BJ from '../build/BankJetton/tact_BankJetton';
import { buildOnchainMetadata } from '../utils/jetton-helpers';
import { Address } from '@ton/core';
import { bytesToBits } from '@ton/crypto/dist/utils/binary';
import { base64Decode } from '@ton/sandbox/dist/utils/base64';

export async function run(provider: NetworkProvider) {
    const imgBank = fs.readFileSync('./assets/bnk.webp', 'binary')
    let s = ''
    for (let i of base64Decode(imgBank)) {
        s += i.toString(16).toUpperCase();
    }
    const to_hex_array: string[] = []
    const hex_array = [];
    //(new Uint8Array(buffer)).forEach((v) => { hex_array.push(to_hex_array[v]) });
    for (let i = 0; i < base64Decode(imgBank).byteLength; i++) {
        hex_array.push(to_hex_array[base64Decode(imgBank)[i]]);
    }
    console.log(hex_array.join(""));
    const BNKjettonParams = {
        name: 'BNK jetton',
        description: 'This is description for BNK jetton',
        symbol: 'BNK',
        image_data: 'UklGRtwCAABXRUJQVlA4TM8CAAAv/8A/AP9gpm2b8qfsSbnGgSDbZv60L8Hnf/7r0DeggB2AHSgOxc6hOOwUAA84FGBAoq09VeyAOBxkLpzKtFor5P3fc4xMXEl6N6L/Dty2cST5+ul6mczM7j4A1M/pP6f/nP5z+s8fQOqSn1PVm8mbl/iss/+wBomLRWF/Nz5r7e/o+votuq5+s66l/56uoU+ga+n3qa65a9UV9G2YX5/WPDTr6vmA5A1dNR/J27p6PomumU+oK+UT6/r4h+iq+IfpWvgH68r4dcp5quS6Hn59dJtv062Q68L6NB/SA8TXa6D+t1n73S9Tof4HilWafU/d0KydMS07Wt0Js/PUDU1tfyNJdS8KmbzGuJqm3MlrkVESOuoaYzWNmahrEVvl4EleXg6t3MgL0m9yMJCXlxb5kOYKc7f3RaLUozy2K1QVCrKvr21W41mKNusizzUJiBi3lN3Pgayaum0/ZrFJ29/Zcc9bDdzxyH+m7jbDo5Y8dyutB9KQaknd6W5WrAit8nNAL8WFYNGehJpMpjFZT8A3jieBoiy2iaIpkFsYQVXgs0VSCrKRN7eAHlBayIk+AWgMwI8xhhDHGUAPjsqfX3puUyGDPDMvH0j54FkEGaYNcjAaLpFr4qlyRZLFDwaeRBCE1XLEFZAkC8OdXUCWLB270wtIk/XG6kKbKkiUrynGreoiHr99vyKegBQQEQv21H3E02EvKM0V5IpvbBRyY6VcWhvQ7Tuc3yo2T/85KWMag/e2cQk8t513b12Azu9k+2wuHo/FnnoYi0Ss3rBKKOKQLb+FDoXhi3pLXZJsSEP3Bc+8YRkvCN8N00xykLiSBDofIosEgZa73xZQkdtS3hf91zv6TzhTSsiaUolJkLW4UnoKMOLWG+ZxRZQt7mo8+jYZNCqPvmUJyMy3uMwWOba+XC1/HCh/hX3yv6uh7xinvy2gfk7/Of3n9J/Tf/4IAQA=',
        decimals: '0'
    };

    const bankJettonMaster = provider.open(await BJ.BankJetton.fromInit(Address.parse('0QCj0zI66mVKC_kkRZ-63e7uR9tcpHWxS-C-W-P_Xeroso3_'), buildOnchainMetadata(BNKjettonParams)));

    await bankJettonMaster.send(
        provider.sender(),
        {
            value: toNano('0.05'),
        },
        {
            $$type: 'Deploy',
            queryId: 0n,
        }
    );

    await provider.waitForDeploy(bankJettonMaster.address);

    // run methods on `bankJetton`
}
