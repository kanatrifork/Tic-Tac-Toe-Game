namespace tictactoe;

entity Games {
  key ID  : UUID;
  board   : String;
  winner  : String;
}