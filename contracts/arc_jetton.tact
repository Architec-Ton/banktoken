import "@stdlib/deploy";
import "./jetton/JettonMaster.tact";
import "./jetton/JettonWallet.tact";
import "./imports/message.tact"; 
import "./stake_storage.tact";

contract ArcJettonWallet with JettonWallet {
    balance: Int as coins = 0;
    owner: Address;
    jetton_master: Address;

    init(owner: Address, jetton_master: Address) {
        self.owner = owner;
        self.jetton_master = jetton_master;
    }

    override inline fun calculate_jetton_wallet_init(owner_address: Address): StateInit {
        return initOf ArcJettonWallet(owner_address, self.jetton_master);
    }
}



contract ArcJetton with JettonMaster, Deployable { //TODO , Ownable
    total_supply: Int as coins = 0;
    mintable: Bool = true;
    owner: Address;
    BNKjetton: Address;
    jetton_content: Cell;

    init(_owner: Address, _BNKjetton: Address, _jetton_content: Cell){
        self.owner = _owner;
        self.BNKjetton = _BNKjetton;
        self.jetton_content = _jetton_content;
    }

    
    receive("Claim") {
        let ctx: Context = context();
        let stakingAddress:Address = self.calculate_stake_address(ctx.sender,self.BNKjetton);
        let msg: GetWeighted= GetWeighted{applied_user_address: ctx.sender};
        send(SendParameters{
                to: stakingAddress,
                value: 0,
                mode: (SendRemainingValue + SendIgnoreErrors),
                bounce: true,
                body:msg.toCell(),
            });
    }
    // answer for Claim
    receive(_msg: Mint) {
        let ctx: Context = context();
        let stakingAddress:Address = self.calculate_stake_address(_msg.to ,self.BNKjetton);
        // require(ctx.sender == stakingAddress,  "Not allowed sender");
        let msg: JettonMint = JettonMint{
            origin: _msg.to,
            receiver: _msg.to,
            amount: _msg.amount,
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
        return initOf ArcJettonWallet(owner_address, myAddress());
    }

    get fun calculate_stake_address(_owner: Address, _factory: Address): Address {
        
        return contractAddress(initOf StakeStorage(_owner, _factory));
    }
    
}