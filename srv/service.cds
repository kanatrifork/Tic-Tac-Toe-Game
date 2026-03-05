using tictactoe from '../db/schema.cds';

service CatalogService {
  entity Games as projection on tictactoe.Games;
}