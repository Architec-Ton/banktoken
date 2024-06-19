import "@stdlib/deploy";
// import "@stdlib/ownable";

import "./jetton/JettonMaster.tact";
import "./jetton/JettonWallet.tact";

contract BankJettonWallet with JettonWallet {
    balance: Int as coins = 0;
    owner: Address;
    jetton_master: Address;

    init(owner: Address, jetton_master: Address) {
        self.owner = owner;
        self.jetton_master = jetton_master;
    }

    override inline fun calculate_jetton_wallet_init(owner_address: Address): StateInit {
        return initOf BankJettonWallet(owner_address, self.jetton_master);
    }
}

contract BankJetton with JettonMaster, Deployable{ //TODO  Ownable
    total_supply: Int as coins = 0;
    mintable: Bool = true;
    owner: Address;
    jetton_content: Cell;

    init(owner: Address, jetton_content: Cell){
        self.owner = owner;
        self.jetton_content = jetton_content;
    }

    receive("Mint:1") {
        let ctx: Context = context();
        let msg: JettonMint = JettonMint{
        origin: ctx.sender,
        receiver: ctx.sender,
        amount: ton("1"),
        custom_payload: emptyCell(),
        forward_ton_amount: 0,
        forward_payload: emptySlice()
        };
        self._mint_validate(ctx, msg);
        self._mint(ctx, msg);
    }

    override inline fun _mint_validate(ctx: Context, msg: JettonMint) {
        require(self.mintable, "JettonMaster: Jetton is not mintable");
    }

    override inline fun calculate_jetton_wallet_init(owner_address: Address): StateInit {
        return initOf BankJettonWallet(owner_address, myAddress());
    }


}