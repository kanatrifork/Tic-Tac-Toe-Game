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

    const GAME_STORAGE_KEY = "gameId";
    const SESSION_STORAGE_KEY = "sessionId";

    return Controller.extend("tictactoe.app.controller.App", {
      onInit: function () {
        const oGameModel = new JSONModel({
          gameId: null,
          cells: ["", "", "", "", "", "", "", "", ""],
          statusText: "Start a new session to play",
          canPlay: true,
          gameOver: false,
          botThinking: false,
          gameState: "NOT_STARTED",
          history: [],
        });
        this.getView().setModel(oGameModel, "game");

        const oSessionModel = new JSONModel({
          sessionId: null,
          bestOf: 3,
          mode: "HvH",
          xWins: 0,
          oWins: 0,
          draws: 0,
          sessionWinner: null,
          winsNeeded: 2,
        });
        this.getView().setModel(oSessionModel, "session");

        const sSavedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
        if (sSavedSessionId) {
          this._loadSessionData(sSavedSessionId);
        }
        this._loadHistory();
      },

      _resetGameModel: function () {
        this.getView().getModel("game").setData({
          gameId: null,
          cells: ["", "", "", "", "", "", "", "", ""],
          statusText: "Start a new session to play",
          canPlay: true,
          gameOver: false,
          botThinking: false,
          gameState: "NOT_STARTED",
          history: [],
        });
      },

      _resetSessionModel: function () {
        this.getView().getModel("session").setData({
          sessionId: null,
          bestOf: 3,
          mode: "HvH",
          xWins: 0,
          oWins: 0,
          draws: 0,
          sessionWinner: null,
          winsNeeded: 2,
        });
      },

      _callAction: async function (sAction, mParams = {}) {
        const oModel = this.getOwnerComponent().getModel();
        const oAction = oModel.bindContext(sAction);

        Object.entries(mParams).forEach(([k, v]) => {
          oAction.setParameter(k, v);
        });

        await oAction.execute();
        return oAction.getBoundContext().getObject();
      },

      _saveIds: function (oGame, oSession) {
        if (oGame?.ID) localStorage.setItem(GAME_STORAGE_KEY, oGame.ID);
        if (oSession?.ID) localStorage.setItem(SESSION_STORAGE_KEY, oSession.ID);
      },

      onNewSession: async function () {
        const oSessionModel = this.getView().getModel("session");
        const iBestOf = parseInt(oSessionModel.getProperty("/bestOf"), 10);
        const sMode = oSessionModel.getProperty("/mode") || "HvH";

        try {
          const oSession = await this._callAction("/newSession(...)", { bestOf: iBestOf, mode: sMode });
          this._applySession(oSession);
          this._startNewGame();
        } catch (oErr) {
          MessageBox.error("Could not start session: " + oErr.message);
        }
      },

      onEndSession: function () {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(GAME_STORAGE_KEY);

        this._resetSessionModel();
        this._resetGameModel();
      },

      onSessionButton: function () {
        const sGameState = this.getView().getModel("game").getProperty("/gameState");
        if (sGameState === "NOT_STARTED") {
          this.onNewSession();
        } else {
          this.onEndSession();
        }
      },

      onNextMatch: function () {
        this._startNewGame();
      },

      _startNewGame: async function () {
        const oSessionModel = this.getView().getModel("session");
        const sSessionId = oSessionModel.getProperty("/sessionId");

        if (!sSessionId) return;

        const oGameModel = this.getView().getModel("game");
        oGameModel.setProperty("/gameOver", false);

        try {
          const oGame = await this._callAction("/newGame(...)", { sessionId: sSessionId });
          this._applyGame(oGame);
        } catch (oErr) {
          MessageBox.error("Could not start a new game: " + oErr.message);
        }
      },

      onCellPress: async function (oEvent) {
        const oButton = oEvent.getSource();
        const iPos = parseInt(oButton.data("pos"), 10);
        const oModel = this.getView().getModel("game");
        const sGameId = oModel.getProperty("/gameId");
        const bGameOver = oModel.getProperty("/gameOver");
        const bWaiting = oModel.getProperty("/botThinking");

        if (!sGameId || bGameOver || bWaiting) return;

        const sMode = this.getView().getModel("session").getProperty("/mode");
        if (sMode === "HvB") {
          oModel.setProperty("/botThinking", true);
          oModel.setProperty("/statusText", "Bot is thinking…");
        }

        try {
          const oGame = await this._callAction("/makeMove(...)", { gameId: sGameId, position: iPos });
          this._applyGame(oGame);
          if (oGame.winner) {
            this._loadHistory();
            this._loadSessionData();
          }
        } catch (oErr) {
          const sMsg = oErr.error?.message ?? oErr.message ?? "Move failed";
          MessageBox.warning(sMsg);
        } finally {
          oModel.setProperty("/botThinking", false);
        }
      },

      _loadSessionData: async function (sSessionId) {
        if (!sSessionId) {
          sSessionId = this.getView().getModel("session").getProperty("/sessionId");
        }
        if (!sSessionId) return;

        const oSession = await this._loadSession(sSessionId);
        if (!oSession) return;

        const sSavedGameId = localStorage.getItem(GAME_STORAGE_KEY);
        if (sSavedGameId) {
          await this._loadGame(sSavedGameId);
        }
      },

      _loadSession: async function (sSessionId) {
        try {
          const oDataModel = this.getOwnerComponent().getModel();
          const oCtx = oDataModel.bindContext("/Sessions(" + sSessionId + ")");
          const oSession = await oCtx.requestObject();

          if (oSession) {
            this._applySession(oSession);
            return oSession;
          }
        } catch {}

        localStorage.removeItem(SESSION_STORAGE_KEY);
        localStorage.removeItem(GAME_STORAGE_KEY);
        return null;
      },

      _loadGame: async function (sGameId) {
        try {
          const oDataModel = this.getOwnerComponent().getModel();
          const oCtx = oDataModel.bindContext("/Games(" + sGameId + ")");
          const oGame = await oCtx.requestObject();

          if (oGame) {
            this._applyGame(oGame, true);
            return oGame;
          }
        } catch {}

        localStorage.removeItem(GAME_STORAGE_KEY);
        return null;
      },

      _applySession: function (oSession) {
        if (!oSession) return;
        const oModel = this.getView().getModel("session");
        const iWinsNeeded = Math.floor(oSession.bestOf / 2) + 1;

        this._saveIds(null, oSession);

        oModel.setProperty("/sessionId", oSession.ID);
        oModel.setProperty("/bestOf", oSession.bestOf);
        oModel.setProperty("/mode", oSession.mode || "HvH");
        oModel.setProperty("/xWins", oSession.xWins);
        oModel.setProperty("/oWins", oSession.oWins);
        oModel.setProperty("/draws", oSession.draws);
        oModel.setProperty("/sessionWinner", oSession.sessionWinner);
        oModel.setProperty("/winsNeeded", iWinsNeeded);

        if (oSession.sessionWinner) {
          const sMode = oSession.mode || "HvH";
          let sMsg;
          if (sMode === "HvB") {
            sMsg = oSession.sessionWinner === "X" ? "You win the session!" : "Bot wins the session!";
          } else {
            sMsg = "Player " + oSession.sessionWinner + " wins the session!";
          }
          this.getView().getModel("game").setProperty("/gameState", "SESSION_OVER");
          MessageBox.success(sMsg, { title: "Session Complete" });
        }
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

      _applyGame: function (oGame, bSuppressMessage) {
        if (!oGame) return;
        const oModel = this.getView().getModel("game");
        const oSessionModel = this.getView().getModel("session");
        const aCells = oGame.board.split("").map((c) => (c === "-" ? "" : c));
        const bOver = !!oGame.winner;

        // Use backend-provided currentPlayer, or compute fallback for loaded games
        const sCurrentPlayer = oGame.currentPlayer ||
          (aCells.filter((c) => c === "X").length <= aCells.filter((c) => c === "O").length ? "X" : "O");

        const sMode = oSessionModel.getProperty("/mode") || "HvH";
        let sStatus;
        if (oGame.winner === "draw") {
          sStatus = "It's a draw!";
        } else if (oGame.winner) {
          if (sMode === "HvB") {
            sStatus = oGame.winner === "X" ? "You win!" : "Bot wins!";
          } else {
            sStatus = "Player " + oGame.winner + " wins!";
          }
        } else {
          if (sMode === "HvB") {
            sStatus = sCurrentPlayer === "X" ? "Your turn" : "Bot's turn";
          } else {
            sStatus = "Player " + sCurrentPlayer + "'s turn";
          }
        }

        this._saveIds(oGame, null);

        oModel.setProperty("/gameId", oGame.ID);
        oModel.setProperty("/cells", aCells);
        oModel.setProperty("/statusText", sStatus);
        oModel.setProperty("/canPlay", true);
        oModel.setProperty("/gameOver", bOver);

        // Use backend-provided gameState, or compute fallback for loaded games
        let sGameState = oGame.gameState;
        if (!sGameState) {
          if (oSessionModel.getProperty("/sessionWinner")) {
            sGameState = "SESSION_OVER";
          } else if (bOver) {
            sGameState = "MATCH_OVER";
          } else {
            sGameState = "PLAYING";
          }
        }
        oModel.setProperty("/gameState", sGameState);

        if (bOver && !bSuppressMessage && oGame.gameState !== "SESSION_OVER") {
          MessageBox.information(sStatus, { title: "Match Over" });
        }
      },
    });
  },
);
