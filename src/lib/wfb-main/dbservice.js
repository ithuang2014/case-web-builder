
var sql = require('mssql');

var DBService = function() {

	var self = this;

	/*  Storage for temporary data on running */
	self.appStorage = {
		db_connection: {}
	};

	self.connect_db = function(config, s_callback, e_callback) {
		self.disconnect_db();

		self.connection = new sql.Connection(config, function(err) {
			if (err && err != undefined) {
				e_callback();
				console.log(err);
				window.alert(err.message);
				// wfbuilder.show_alert(2, err.message);
				return;
			}

			// wfbuilder.show_alert(0, "Connected to database successfully!");
			s_callback();
			self.save_connection();
			self.do_init();
		});
	};

	self.disconnect_db = function() {
		if (self.connection == undefined)
			return;
		if (!self.connection.connected)
			return;

		// disconnects db connection and initilize idWfClass to -1
		self.connection.close();
		self.appStorage.db_connection.idWfClass = -1;
	};

	self.is_connected = function() {
		if (self.connection == undefined)
			return false;
		return self.connection.connected;
	};

	/* gets 'Attrib' table data
		to get 'idEnt' for the columns for one-to-one table	*/
	self.do_init = function() {
		query = "select [idEnt], [entType], [entDisplayAttrib], [entSrc] from entity where entType in (1,2)";
		self.connection.request().query(query, function(err, recordset) {
			if (err != undefined) {
				window.alert(err.message);
				return;
			}
			
			self.appStorage.entity = {};
			for (i = 0 ; i < recordset.length ; i ++) {
				var ent = {};
				ent.entType = recordset[i].entType;
				ent.entSrc = recordset[i].entSrc;
				ent.entDisplayAttrib = recordset[i].entDisplayAttrib;

				self.appStorage.entity[recordset[i].idEnt] = ent;
			}
		});
	};

	/*  functions for saving db connection: connection config, idWfClass */
	self.save_connection = function() {
		var server = self.connection.config.server;

		if (self.connection.config.options.instanceName)
			server += "\\" + self.connection.config.options.instanceName;

		self.appStorage.db_connection.config = {
			user: self.connection.config.user,
			password: self.connection.config.password,
			server: server,
			database: self.connection.config.database,
			port: self.connection.config.port
		};
	};

	self.save_idWfClass = function(val) {
		self.appStorage.db_connection.idWfClass = val;
	};

	self.is_root_table_set = function() {
		return self.appStorage.db_connection.idWfClass > 0;
	};

	self.get_wfCls = function(callback) {
		query = "select idWfClass, guidWFClass, wfClsDisplayName from wfclass";

		self.connection.request().query(query, function(err, recordset) {
			if (err != undefined) {
				window.alert(err.message);
				return;
			}
			callback(recordset);
		});
	};

	self.get_root_table = function(callback) {
		query = "select ent.idEnt, ent.entName as attribName, ent.entDisplayName as attribDisplayName, ent.entType \
				from ENTITY ent, BAWFCLASS_ENTITY bent where ent.idEnt = bent.idEnt and idWfClass = " +
				self.appStorage.db_connection.idWfClass;

		self.connection.request().query(query, function(err, recordset) {
			if (err && err != undefined) {
				window.alert(err.message);
				return;
			}

			recordset[0].attribAttributeType = 1;			
			callback(recordset);
		});
	};

	/* gets columns for a specific table 'tb' */
	self.get_columns = function(tb, callback) {
		query = "select a.attribAttributeType,a.[attribName],a.[attribDisplayName],a.[idEntRelated] as idEnt from attrib a, entity b where a.idEnt = b.ident and entType in (1,2) and entSrcType in (1,3) and a.idEnt = "
				+ tb.idEnt + " order by a.attribDisplayOrder";

		self.connection.request().query(query, function(err, recordset) {
			if (err && err != undefined) {
				window.alert(err.message);
				return;
			}
			
			/* for the columns with 'attribAttributeType' as 1 that means one-to-one table
			    gets 'idEnt' of each */
			for(i = 0; i < recordset.length; i ++) {
				if (recordset[i].attribAttributeType != 1)
					continue;
				recordset[i].entType = self.appStorage.entity[recordset[i].idEnt].entType;
				recordset[i].entDisplayAttrib = self.appStorage.entity[recordset[i].idEnt].entDisplayAttrib;
			}

			/* now gets one-to-many tables of specific table 'tb' */
			query = "SELECT [factName] as attribName ,[factDisplayName] as attribDisplayName ,[idRightEntity] as idEnt FROM fact where idLeftEntity = "
					+ tb.idEnt + " order by attribName";
			self.connection.request().query(query, function(err, recordset1) {
				if (err && err != undefined) {
					window.alert(err.message);
					return;
				}

				/* sets 'entType' to 1000001 so as to distinguish from one-to-one tables
				    to show column avatar */
				for(i = 0; i < recordset1.length; i ++) {
					recordset1[i].attribAttributeType = 1;
					recordset1[i].entType = 1000001;
				}

				callback(recordset1.concat(recordset));
			});
		});
	};

	/* gets value list for a specified column of a table */
	self.get_valueList = function(idEnt, column, callback) {
		var query = "select [";
		if (typeof column == "object") {
			query += column[0];
			for (var i = 1 ; i < column.length ; i ++) {
				query += "], [" + column[i];
			}
		} else {
			query += column;
		}
		query += "] from " + self.appStorage.entity[idEnt].entSrc;

		self.connection.request().query(query, function(err, recordset) {
			if (err && err != undefined) {
				window.alert(err.message);
				return;
			}
			
			callback(recordset);
		});
	};

	self.save_db_credential = function() {
		if (!self.is_connected())
			return;
		localStorage.setItem("db_setting", JSON.stringify(self.appStorage.db_connection.config));
	}
	self.get_db_credential = function() {
		var res = localStorage.getItem("db_setting");
		return res == null ? null : JSON.parse(res);
	}
};

var dbService = new DBService();
