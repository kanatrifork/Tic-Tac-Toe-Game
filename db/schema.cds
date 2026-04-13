namespace tictactoe;

entity Sessions {
  key ID            : UUID;
      bestOf        : Integer default 3;
      xWins         : Integer default 0;
      oWins         : Integer default 0;
      draws         : Integer default 0;
      sessionWinner : String;
      createdAt     : DateTime;
      completedAt   : DateTime;
      games         : Composition of many Games
                        on games.session = $self;
}

entity Games {
  key ID          : UUID;
      session     : Association to Sessions;
      board       : String;
      winner      : String;
      createdAt   : DateTime;
      completedAt : DateTime;
}
