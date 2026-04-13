sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageBox) {
    "use strict";

    return Controller.extend("tictactoe.app.controller.App", {

        onInit: function () {
            const oModel = new JSONModel({
                gameId: null,
                cells: ["", "", "", "", "", "", "", "", ""],
                statusText: "Press 'New Game' to start",
                canPlay: true,
                gameOver: false
            });
            this.getView().setModel(oModel, "game");
        },

        onNewGame: function () {
            const oModel = this.getView().getModel("game");
            oModel.setProperty("/gameOver", false);
            const oDataModel = this.getOwnerComponent().getModel();

            const oAction = oDataModel.bindContext("/newGame(...)");
            oAction.execute().then(() => {
                const oGame = oAction.getBoundContext().getObject();
                this._applyGame(oGame);
            }).catch((oErr) => {
                MessageBox.error("Could not start a new game: " + oErr.message);
            });
        },

        onCellPress: function (oEvent) {
            const oButton = oEvent.getSource();
            const iPos = parseInt(oButton.data("pos"), 10);
            const oModel = this.getView().getModel("game");
            const sGameId = oModel.getProperty("/gameId");
            const bGameOver = oModel.getProperty("/gameOver");

            if (!sGameId || bGameOver) return;

            const oDataModel = this.getOwnerComponent().getModel();
            const oAction = oDataModel.bindContext("/makeMove(...)");
            oAction.setParameter("gameId", sGameId);
            oAction.setParameter("position", iPos);

            oAction.execute().then(() => {
                const oGame = oAction.getBoundContext().getObject();
                this._applyGame(oGame);
            }).catch((oErr) => {
                const sMsg = oErr.error?.message ?? oErr.message ?? "Move failed";
                MessageBox.warning(sMsg);
            });
        },

        _applyGame: function (oGame) {
            if (!oGame) return;
            const oModel = this.getView().getModel("game");
            const aCells = oGame.board.split("").map((c) => (c === "-" ? "" : c));
            const bOver = !!oGame.winner;

            let sStatus;
            if (oGame.winner === "draw") {
                sStatus = "It's a draw!";
            } else if (oGame.winner) {
                sStatus = "Player " + oGame.winner + " wins!";
            } else {
                const xs = aCells.filter((c) => c === "X").length;
                const os = aCells.filter((c) => c === "O").length;
                sStatus = "Player " + (xs <= os ? "X" : "O") + "'s turn";
            }

            oModel.setProperty("/gameId", oGame.ID);
            oModel.setProperty("/cells", aCells);
            oModel.setProperty("/statusText", sStatus);
            oModel.setProperty("/canPlay", true);
            oModel.setProperty("/gameOver", bOver);

            if (bOver) {
                MessageBox.information(sStatus, { title: "Game Over" });
            }
        }
    });
});
