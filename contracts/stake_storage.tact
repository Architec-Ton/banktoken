// import "@stdlib/deploy";
// import "@stdlib/Ownable";
// import "./storage.tact";
import "./imports/message.tact"; 

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
    receive(msg: Sub) {
        let ctx: Context = context(); // Check sender
        require(ctx.sender == self.factory, "Invalid sender");
        self.amount += msg.amount;
        self.updatetime = now();
    } 

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

 
    init(_owner: Address, _factory:Address) {
        
        self.previousCell = newAddress(0,0);
        self.nextCell =  newAddress(0,0);
        self.factory = _factory; 
        self.owner = _owner;
    }

    receive(_msg: Add) {
        let ctx: Context = context(); // Check sender
        // require(ctx.sender == self.factory, "Invalid sender");
        // require(self.empty, "Already filled");
        self.amount += _msg.amount;
        self.updatetime = now();
        self.previousCell= _msg.previousCell;
        self.nextCell = _msg.nextCell;
        self.empty = false;
    }

    receive (_msg: GetWeighted) {
        let ctx: Context = context();
        // let ap: AmountTime =  AmountTime{for: _msg.applied_user_address,
        //                                 stakedAmount: self.amount,
        //                                 time: self.updatetime,
        //                                 calculatedAmount: self.score_function()};
        let mint: Mint = Mint{
            to: _msg.applied_user_address,
            amount: self.score_function()
        };
        send(SendParameters{
                to: ctx.sender,
                value: 0,
                mode: (SendRemainingValue + SendIgnoreErrors),
                bounce: true,
                body:mint.toCell()
            }
        );
        self.updatetime = now();
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
        if (self.amount < 10) {parameter = 1;} // div with 1000
        else if (self.amount < 100) {parameter = 11;}
        else if (self.amount < 1000) {parameter = 220;}
        else if (self.amount < 10_000) {parameter = 2500;}
        else {parameter = 30_000;}
        dump( "self.amount");
        dump( self.amount);
        dump( "parameter");
        dump( parameter);
        return (self.amount * self.durationTime() * parameter / 86400000);  // 60sec*60min*24hour*1000 for parameter )

    }

    fun durationTime(): Int {
        return now() - self.updatetime;
    }


}
