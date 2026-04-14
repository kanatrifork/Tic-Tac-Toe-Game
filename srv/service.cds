using tictactoe from '../db/schema.cds';

service CatalogService {
  entity Sessions as projection on tictactoe.Sessions;
  entity Games as projection on tictactoe.Games;

  action newSession(bestOf : Integer, mode : String)  returns Sessions;
  action newGame(sessionId : UUID)                    returns Games;
  action makeMove(gameId : UUID, position : Integer)  returns Games;
}