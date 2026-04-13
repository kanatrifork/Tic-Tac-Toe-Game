sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
  ],
  function (Controller, JSONModel, MessageBox, Filter, FilterOperator, Sorter) {
    "use strict";

    const STORAGE_KEY = "gameId";

    return Controller.extend("tictactoe.app.controller.App", {
      onInit: function () {
        const oModel = new JSONModel({
          gameId: null,
          cells: ["", "", "", "", "", "", "", "", ""],
          statusText: "Press 'New Game' to start",
          canPlay: true,
          gameOver: false,
          history: [],
        });
        this.getView().setModel(oModel, "game");

        const sSavedId = localStorage.getItem(STORAGE_KEY);
        if (sSavedId) {
          this._loadGame(sSavedId);
        }
        this._loadHistory();
      },

      onNewGame: function () {
        localStorage.removeItem(STORAGE_KEY);
        const oModel = this.getView().getModel("game");
        oModel.setProperty("/gameOver", false);
        const oDataModel = this.getOwnerComponent().getModel();

        const oAction = oDataModel.bindContext("/newGame(...)");
        oAction
          .execute()
          .then(() => {
            const oGame = oAction.getBoundContext().getObject();
            this._applyGame(oGame);
          })
          .catch((oErr) => {
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

        oAction
          .execute()
          .then(() => {
            const oGame = oAction.getBoundContext().getObject();
            this._applyGame(oGame);
            if (oGame.winner) {
              this._loadHistory();
            }
          })
          .catch((oErr) => {
            const sMsg = oErr.error?.message ?? oErr.message ?? "Move failed";
            MessageBox.warning(sMsg);
          });
      },

      _loadGame: function (sGameId) {
        const oDataModel = this.getOwnerComponent().getModel();
        const oContext = oDataModel.bindContext("/Games(" + sGameId + ")");
        oContext
          .requestObject()
          .then((oGame) => {
            if (oGame) {
              this._applyGame(oGame);
            } else {
              localStorage.removeItem(STORAGE_KEY);
            }
          })
          .catch(() => {
            localStorage.removeItem(STORAGE_KEY);
          });
      },

      _loadHistory: function () {
        const oDataModel = this.getOwnerComponent().getModel();
        const oListBinding = oDataModel.bindList(
          "/Games",
          null,
          [new Sorter("completedAt", true)],
          [new Filter("winner", FilterOperator.NE, null)],
        );
        oListBinding
          .requestContexts(0, 50)
          .then((aContexts) => {
            const aHistory = aContexts.map((oCtx) => {
              const oGame = oCtx.getObject();
              oGame.completedAtFormatted = this._formatDateTime(oGame.completedAt);
              return oGame;
            });
            this.getView().getModel("game").setProperty("/history", aHistory);
          })
          .catch(() => {});
      },

      _formatDateTime: function (sIsoDate) {
        if (!sIsoDate) return "";
        const oDate = new Date(sIsoDate);
        return oDate.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit"
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

        localStorage.setItem(STORAGE_KEY, oGame.ID);

        oModel.setProperty("/gameId", oGame.ID);
        oModel.setProperty("/cells", aCells);
        oModel.setProperty("/statusText", sStatus);
        oModel.setProperty("/canPlay", true);
        oModel.setProperty("/gameOver", bOver);

        if (bOver) {
          MessageBox.information(sStatus, { title: "Game Over" });
        }
      },
    });
  },
);
