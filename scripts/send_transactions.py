from tonsdk.contract.wallet import Wallets, WalletVersionEnum
from tonsdk.contract import Address
from tonsdk.boc import begin_cell
from tonsdk.utils import to_nano, bytes_to_b64str
from requests import post

from os import getenv
from dotenv import load_dotenv

import time

load_dotenv()
api = getenv('API_KEY')
main_mnemonics = getenv('MNEMONICS').split()
crowd_sale_address = 'kQAt4fm9DfqnGx23M3WmweCT8u0cvRpT-TH5fsxqbN-mUK_C'


def send_boc(bc):
    payload = {"boc": bc}
    url = "https://testnet.toncenter.com/api/v2/sendBoc"
    inf = post(url=url, json=payload, headers={"X-API-Key": api}, timeout=15).json()

    return inf


def get_seqno(address):
    payload = {"method": "runGetMethod",
               "params": {"address": address,
                          "method": "seqno",
                          "stack": []},
               "id": "1",
               "jsonrpc": "2.0", }

    r = post(url="https://testnet.toncenter.com/api/v2/jsonRPC",
             json=payload)

    if r.status_code == 200:
        return int(r.json()["result"]["stack"][0][1], 16)


def to_recipe(address, ref_address, amount, bank_amount, send_mode):
    def store_bonus(b):
        cell = begin_cell() \
            .store_uint(3122429960, 32) \
            .store_address(Address(b['to'])) \
            .store_uint(b['amount'], 32) \
            .end_cell()

        return cell

    bon = {'type': 'Bonus', 'to': ref_address, 'amount': bank_amount}
    payload = begin_cell().store_ref(store_bonus(bon)).end_cell()

    return {'address': address,
            'amount': to_nano(amount, 'ton'),
            'payload': payload,
            'send_mode': send_mode}


def hv_transfer(recipes, mnemonics):
    mnemonics, pub_k, priv_k, wallet = Wallets.from_mnemonics(mnemonics, WalletVersionEnum.hv2, 0)

    query = wallet.create_transfer_message(recipients_list=recipes,
                                           query_id=0)

    boc = bytes_to_b64str(query["message"].to_boc(False))
    return send_boc(boc)


def transfer(address, amount, message, wallet_mnemonics, send_mode=3):
    to_wallet = str(address)
    wallet_workchain = 0
    wallet_version = WalletVersionEnum.v4r2

    mnemonics, pub_k, priv_k, wallet = Wallets.from_mnemonics(wallet_mnemonics, wallet_version, wallet_workchain)

    query = wallet.create_transfer_message(to_addr=to_wallet,
                                           amount=int(to_nano(float(amount), 'ton')),
                                           payload=message,
                                           seqno=get_seqno(str(wallet.address.to_string(True, True, True))),
                                           send_mode=send_mode)

    boc = bytes_to_b64str(query["message"].to_boc(False))
    return send_boc(boc)


def send_hv(dct, mnemonics, send_mode=3):
    addresses = list(dct.keys())
    num_of_addr = 250
    to_crowd_amount = 0.55

    for i in range(0, len(addresses), num_of_addr):
        recipes = [to_recipe(crowd_sale_address, address, to_crowd_amount, dct[address], send_mode)
                   for address in addresses[i:i+num_of_addr]]
        f = hv_transfer(recipes, mnemonics)
        if not f['ok']:
            print(f, recipes)
            time.sleep(10)
        time.sleep(25)


if __name__ == '__main__':
    send_hv({'EQDD7-865WCs4QeyMMx7OTaquFkeyDE4MEPIcuIs3CxTK4DO': 10}, main_mnemonics)
