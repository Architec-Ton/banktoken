// import "@stdlib/deploy";
// import "@stdlib/Ownable";
// import "./storage.tact";
import "./imports/message.tact";
import "./jetton/JettonWallet.tact";

trait Storage /* with Ownable  with Deployable */ {

    amount: Int;
    updatetime: Int;
    previousCell: Address;
    nextCell: Address;
    factory: Address;

    /*
        receive(msg: Add) {
            let ctx: Context = context(); // Check sender
            require(ctx.sender == self.factory, "Invalid sender");
            self.amount += msg.amount;
            self.updatetime = now();
            self.previousCell= msg.previousCell;
            self.nextCell = msg.nextCell;
        }
     */
    // receive(msg: Sub) {
    //     let ctx: Context = context(); // Check sender
    //     require(ctx.sender == self.factory, "Invalid sender");
    //     self.amount += msg.amount;
    //     self.updatetime = now();
    // } 

    receive (msg: UpdateNext) {
        let ctx: Context = context(); // Check sender
        // require(ctx.sender == self.factory, "Invalid sender");
        self.nextCell = msg.nextCell;
    }

    receive ("GetPrevNextCells") {
        let ctx: Context = context();
        let pn: PrevNextCells = PrevNextCells{previous: self.previousCell, next:  self.nextCell};
        send(SendParameters{
        to: ctx.sender,
        value: 0,
        mode: (SendRemainingValue + SendIgnoreErrors),
        bounce: true,
        body:pn.toCell()
        }
        );
    }

    get fun  prevnextcells(): PrevNextCells {
        return PrevNextCells{previous: self.previousCell, next:  self.nextCell};
    }
}


contract StakeStorage with  Storage {
    amount: Int as uint32 = 0;
    updatetime: Int as uint32 = 0;
    previousCell: Address;
    nextCell: Address;
    factory: Address;
    owner: Address;
    empty: Bool = true;
    stakerWallet: Address;

    init(_owner: Address, _factory:Address) {

        self.previousCell = newAddress(0,0);
        self.nextCell =  newAddress(0,0);
        self.stakerWallet = newAddress(0,0);
        self.factory = _factory;
        self.owner = _owner;
    }

    receive(_msg: Add) {
        let ctx: Context = context(); // Check sender
        require(ctx.sender == self.factory, "Invalid sender");
        require(self.empty, "Already filled");
        self.amount += _msg.amount;
        self.updatetime = now();
        self.previousCell= _msg.previousCell;
        self.nextCell = _msg.nextCell;
        self.stakerWallet = _msg.stakerWallet;
        self.empty = false;        
    }

    receive (_msg: GetWeighted) {

        let ctx: Context = context();
        require (ctx.sender == self.factory, "wrong call" );
        require(_msg.applied_user_address == self.owner, "Not owner");
        require (self.amount > 0, "No staking amount");
        let mint: Mint = Mint{
            to: _msg.applied_user_address,
            amount: self.score_function()
        };
        send(SendParameters{
        to: ctx.sender,
        value: 0,
        mode: (SendRemainingValue /* + SendIgnoreErrors */),
        bounce: true,
        body:mint.toCell()
        }
        );
        self.updatetime = now();
    }


    receive (_msg: Unstake) {
        // dump("unstake");
        let ctx: Context = context();
        require (ctx.sender == self.factory, "wrong call" );
        require(_msg.applied_user_address == self.owner, "Not owner");
        let mint: Mint = Mint{
            to: self.owner, //_msg.applied_user_address,
            amount: self.score_function()
        };
        send(SendParameters{
            to: ctx.sender,
            value: ton("1"),
            mode: ( SendIgnoreErrors ),
            bounce: true,
            body:mint.toCell()
            });
        // dump ("returnBNK");
        send(SendParameters{
            to: self.stakerWallet,
            value: 0,
            mode: (SendRemainingValue  + SendIgnoreErrors  ), //?
            bounce: true, // 0x7362d09c - notify new owner
            body: JettonTransfer{
                query_id: 0,
                amount: self.amount,
                destination:  self.owner, 
                response_destination:  self.owner,
                custom_payload: null,
                forward_ton_amount:0,
                forward_payload: emptySlice()
            }.toCell()
        });

        self.amount= 0;
        self.updatetime = now();
        self.empty = false;        

    }
    get fun amountTime(_for: Address): AmountTime {
        return   AmountTime{for: _for,
        stakedAmount: self.amount,
        time: self.updatetime,
        calculatedAmount: self.score_function()};
    }

    fun score_function(): Int {
        let parameter: Int = 0;
        /*   parameter
        FARM SPEED
        Количество   BNK (Банки)
        Скорость   добычи ARC/DAY
        1-9   BNK       0.001
        10-99  BNK      0.011
        100-999 BNK     0.22
        1000-9999 BNK   2.5
        10000   + BNK   30
    */
        if (self.amount < 10) {parameter = ton("0.001");} // div with 1000
        else if (self.amount < 100) {parameter = ton("0.011");}
        else if (self.amount < 1000) {parameter = ton("0.22");}
        else if (self.amount < 10_000) {parameter = ton("2.5");}
        else {parameter = ton("30");
        }
        if (self.amount == 0) {
            return 0;
        }
        else {
            return (/* self.amount *  */self.durationTime() * parameter / 86400);  // 60sec*60min*24hour  )
        }
    }

    fun durationTime(): Int {
        return now() - self.updatetime;
    }


}
