using tictactoe from '../db/schema.cds';

service CatalogService {
  entity Games as projection on tictactoe.Games;

  action newGame()                                    returns Games;
  action makeMove(gameId : UUID, position : Integer)  returns Games;
}