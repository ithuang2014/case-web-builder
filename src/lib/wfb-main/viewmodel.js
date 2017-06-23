var gui = require("nw.gui");

function title_handler() {
	var self = this;

	self.su_h = su_h;
	/* current_state: 'ws' then shows all button on title bar
					  'st' then shows only App Logo button without dropdown */
	self.current_state = ko.computed(function() {
		return cv_h.opened_files().length > 0 ? 'ws' : 'st';
	});
	self.current_title = ko.observable("");
	self.canUndo = ko.computed(function() {
		if (cv_h.opened_files().length == 0) return false;
		var kp = cv_h.opened_files()[cv_h.active_file()];
		if (!kp) return false;
		var cp = kp.crsaPage();
		if (!cp) return false;
		return cp.undoStack.canUndo();
	});
	self.canRedo = ko.computed(function() {
		if (cv_h.opened_files().length == 0) return false;
		var kp = cv_h.opened_files()[cv_h.active_file()];
		if (!kp) return false;
		var cp = kp.crsaPage();
		if (!cp) return false;
		return cp.undoStack.canRedo();
	});

	self.show_options_modal = function() {
		wfbuilder.show_options_modal();
	}
	self.exit = function() {
		var closeWindow = function() {
			dbService.disconnect_db();
			window.close();
		}

		if (cv_h.opened_files().length > 0) {
			var changes = false;
			for (i = 0 ; i < cv_h.opened_files().length ; i ++) {
				var cp = cv_h.opened_files()[i].crsaPage();
				if (cp.changed) changes = true;
			}

			if (changes) {
				showAlert("One or more pages have unsaved changes. Are you sure you want to quit the app?", "Unsaved Changes", "Don't quit", "Quit", null, function() {
					wfbuilder.closeCodeEditor();
					closeWindow();
				});
				return;
			}
		}
		closeWindow();
	}
	self.minimize = function() {
		gui.Window.get().minimize();
	}
	self.save = function() {
		wfbuilder.save_current_page();
	}
	self.save_as = function() {
		wfbuilder.save_as_current_page();
	}
	self.close = function() {
		wfbuilder.close_current_page();
	}
	self.create_new_page = function() {
		wfbuilder.create_new_page();
	}
	self.edit_existing = function() {
		wfbuilder.open_existing_page();
	}
	self.duplicate_page = function() {
		wfbuilder.duplicate_current_page();
	}
	self.undo = function() {
		wfbuilder.undo();
	}
	self.redo = function() {
		wfbuilder.redo();
	}
}

function startup_handler() {
	var self = this;
	
	/* db setting variables are defined below */

	self.s_url = ko.observable('');
	self.port = ko.observable('1433');
	self.db_name = ko.observable('aeonv5');
	self.user = ko.observable('');
	self.pwd = ko.observable('');
	self.connected = ko.observable(false);
	self.rem_me = ko.observable(false);
	self.onConnection = ko.observable(false);

	var retrieve_db = false;

	self.connected.subscribe(function(value) {
		
		//	if toggle on to connect db
		if (value) {
			/* check validation on db setting */
			if (self.user().length == 0 || self.pwd().length == 0 || self.s_url().length == 0 || self.db_name().length == 0) {
				self.connected(false);
				window.alert("invalid db config!");
				return;
			}

			/* if already connected, discard this operation */
			if (dbService.is_connected())
				return;

			if (self.onConnection()) {
				self.connected(false);
				return;
			}

			/* set connected to 'false' because Toggle button must be toggled
			    after the db connection is succeed */
			self.connected(false);
			self.onConnection(true);

			config = {
				user: self.user(),
				password: self.pwd(),
				server: self.s_url(),
				database: self.db_name(),
				port: self.port()
			};

			dbService.connect_db(config, function() {
				self.connected(true);
				self.onConnection(false);

				crsaQuickMessage("Connected to database successfully.");

				dbService.get_wfCls(function(recordset) {
					self.wfClsDisplayName(recordset);
					(function() {
						if (retrieve_db) {
							retrieve_db = false;
							var cre = dbService.get_db_credential();

							if (!cre["idWfClass"] || cre["idWfClass"] == "-1")
								return;

							self.idWfClass(cre["idWfClass"]);
							dbService.save_idWfClass(self.idWfClass());

							if (typeof cv_h == "undefined" || typeof wfbuilder == "undefined")
								return;
							if (cv_h.opened_files().length == 0)
								return;

							wfbuilder.prepare_dbCtrlData()
						}
					}());
				});
			}, function() {
				self.connected(false);
				self.onConnection(false);
			});
 		}
		else {
			if (typeof cv_h != 'undefined' && cv_h.opened_files().length > 0) {

				var $db_ctrList = $("#app_ > ul");
				ko.cleanNode($db_ctrList[0]);
				$db_ctrList.empty();

				// var ss_id = ab_h.t_c_list.subscribe(function(value) {
				// 	ss_id.dispose();
				// 	wfbuilder.prepare_dbCtrlData();
				// });
				ab_h.t_c_list([]);
			}
			self.idWfClass("-1");
			self.rem_me(false);
			self.wfClsDisplayName([]);
			if (dbService.is_connected())
				dbService.disconnect_db();
		}
	});

	/* saves the credential: this operation is valid after db connection is succeed */
	self.rem_me.subscribe(function(value) {
		if (value) {
			dbService.save_db_credential(self.idWfClass());
		}
	});

	/* defines observable array for wfClsDisplayName */
	self.wfClsDisplayName = ko.observableArray([]);

	self.idWfClass = ko.observable("-1");

	/* defines a callback function for 'show.bs.dropdown' of db setting dropdown panel 
	self.db_setting_show = function() {
		console.log("asdfasdf");
		// $("a.db-setting.dropdown-toggle").dropdown("toggle");
	}
	$("div.setting-bar.dropdown").on('show.bs.dropdown', function() {
		console.log("asdfasdf");
	});*/

	self.save_db_setting = function() {
		if (!self.connected()) {
			window.alert("Nothing to save. Please connect DB!");
			return;
		}
		if (self.idWfClass() == "-1") {
			window.alert("Please select wfClsDisplayName!");
			return;
		}

		var changed = dbService.save_idWfClass(self.idWfClass());

		if (self.rem_me()) {
			dbService.save_db_credential(self.idWfClass());
		}

		if (cv_h.opened_files().length > 0 && changed) {

            var $db_ctrList = $("#app_ > ul");
            ko.cleanNode($db_ctrList[0]);
            $db_ctrList.remove();

            wfbuilder.build_app_panel();

			var ss_id = ab_h.t_c_list.subscribe(function(value) {
				ss_id.dispose();
				wfbuilder.prepare_dbCtrlData();
			});
			ab_h.t_c_list([]);
		}
	}

	self.show_options_modal = function() {
		wfbuilder.show_options_modal();
	}

	self.retrieve_db_credential = function() {
		var cre = dbService.get_db_credential();
		
		if (!cre)
			return;

		self.s_url(cre.server);
		self.port(cre.port);
		self.db_name(cre.database);
		self.user(cre.user);
		self.pwd(cre.password);

		crsaQuickMessage("Loading saved db credential...", 2000);
		self.connected(true);

		// showDbLoadingOverlay();

		retrieve_db = true;
	}

	/* below functions are for the 4 buttons on startup */
	self.create_new_page = function() {
		wfbuilder.create_new_page();
	};
	self.edit_existing = function() {
		wfbuilder.open_existing_page();
	};
	self.edit_login = function() {

	};
	self.edit_case = function() {

	};
}
var su_h = new startup_handler();
su_h.retrieve_db_credential();

function ab_handler() {
	var self = this;

	/* the icons and column avatars that will used in db control tree view */
	self.openedClass = 'fa-minus-circle';
	self.closedClass = 'fa-plus-circle';
	self.attrib_icons = {
		1000000: 'fa-clone',
		0: 'fa-briefcase',
		1: 'fa-list-alt',
		2: 'fa-text-width',
		3: 'fa-text-width',
		4: 'fa-text-width',
		5: 'fa-check',
		8: 'fa-usd',
		10: 'fa-text-width',
		11: 'fa-text-width',
		12: 'fa-calendar',
		15: 'fa-text-width',
		1002: 'fa-paperclip',
		1003: 'fa-picture-o',

		13: 'fa-calendar',
		1005: 'fa-calendar',

		23: 'fa-text-width',
		7: 'fa-usd'
	}

	/* a storage for db controls, actually tables and columns */
	self.t_c_list = ko.observableArray([]).extend({rateLimit: {method: 'notifyWhenChangesStop'}});;

	self.expand = function(id, data, event) {
		var tar = $(event.target);
		var par = tar.parent().parent();

		tar.toggleClass(self.openedClass + " " + self.closedClass);
		
		/* if the columns of clicked table are already inserted into 't_c_list', then only
		    toggles them and return */
		if (self.t_c_list()[id].childlist != undefined) {
			par.children("ul").eq(0).toggle();
			return;
		}
		
		tar.removeClass(self.openedClass);
		tar.addClass("fa-spinner fa-pulse");

		/* initalize childlist of clicked table */
		self.t_c_list()[id].childlist = [];

		dbService.get_columns(self.t_c_list()[id], function(recordset, err) {
			tar.removeClass("fa-spinner fa-pulse");
			tar.addClass(self.openedClass);

			if (err) {
				tar.toggleClass(self.openedClass + " " + self.closedClass);
				return;
			}

			/* get columns of clicked table and stores them into 't_c_list'
			    also stores the their indices into childlist */
			for (i = 0 ; i < recordset.length ; i ++) {
				self.t_c_list()[id].childlist.push(self.t_c_list().length);
				recordset[i].par_tcID = id;
				self.t_c_list().push(recordset[i]);
			}
			
			var html = "<ul data-bind=\"foreach: t_c_list()[" + id + "].childlist\">\
							<li data-bind=\"css: $root.t_c_list()[$data].attribAttributeType == 1 ? 'branch': ''\
											,attr: {\'data-record\':$data}\">\
								<span>\
									<!-- ko if: $root.t_c_list()[$data].attribAttributeType == 1 -->\
										<i class=\"indicator fa\" data-bind=\"css: $root.closedClass, click: function(data, event) { $root.expand($data, data, event)}\"></i>\
									<!-- /ko -->\
									<span class=\"db-control\">\
										<span class=\"fa\" data-bind=\"css: $root.t_c_list()[$data].attribAttributeType == 1 ? $root.attrib_icons[$root.t_c_list()[$data].entType - $root.t_c_list()[$data].attribAttributeType] : $root.attrib_icons[$root.t_c_list()[$data].attribAttributeType]\"></span>\
										<span data-bind=\"text: $root.t_c_list()[$data].attribName\"></span>\
									</span>\
								</span>\
							</li>\
						</ul>";

			par.append(html);

			ko.applyBindings(ab_h, par.children().eq(par.children().length - 1)[0]);
		});
	}
}
var ab_h = new ab_handler();

function canvas_handler() {
	var self = this;

	/* an array of Opend files: html, login, case files
		cv_h.opened_files.push({
			name: "untitled.html",
			active: ko.observable(true),
			state: {
				width: ko.observable(1024),
				t_m: ko.observable(true),
				js_en: ko.observable(true),
				css_en: ko.observable(true)
			}
		});*/
	self.opened_files = ko.observableArray([]).extend({rateLimit: {method: 'notifyWhenChangesStop'}});
	self.active_file = ko.observable(-1);

	self.active_file.subscribe(function(value) {
		if (value < 0) {
			tt_h.current_title("");
		} else {
			tt_h.current_title(self.opened_files()[value].name() + " - ");
		}
	});

	self.setSelectedPage = function(page) {
		if (self.active_file() > -1)
			self.opened_files()[self.active_file()].active(false);
		page.active(true);

		for (var i = 0 ; i < self.opened_files().length ; i ++) {
			var kopage = self.opened_files()[i];
			if (kopage === page) {
				self.active_file(i);
				break;
			}
		}
	}

	self.selectPage = function(pageId, data, event) {
		var kopage = self.opened_files()[pageId()];

		if (event.ctrlKey) {
			var visible = kopage.visible();
			kopage.visible(!visible);
		} else {
			for (var i = 0 ; i < self.opened_files().length; i ++) {
				tmp = self.opened_files()[i];
				if (pageId() == i) {
					tmp.visible(true);
					continue;
				}
				tmp.visible(false);
			}
		}

		wfbuilder.setSelectedPage(kopage.crsaPage().$iframe);
		methods.refresh();
	}

	self.scr_menu = [
		{content: "workstation / 1920px", abbr: "1920px", value: 1920},
		{content: "desktop / 1600px", abbr: "1600px", value: 1600},
		{content: "laptop / 1280px", abbr: "1280px", value: 1280},
		{content: "tablet-landscape / 1024px", abbr: "1024px", value: 1024},
		{content: "tablet-portrait / 768px", abbr: "768px", value: 768},
		{content: "phone / 320px", abbr: "320px", value: 320}
	];

	self.set_scrsize = function(new_size) {
		self.opened_files()[self.active_file()].state.width(new_size);

        if(new_size > 5000) new_size = 5000;

		var cp = cv_h.opened_files()[cv_h.active_file()].crsaPage();
		cp.deviceWidth = new_size;

        methods.refresh();
        crsaQuickMessage("Page size is set to " + new_size + "px");
        $('body').trigger('crsa-window-changed', cp);
	};

	self.refresh = function() {
        crsaQuickMessage("Refreshing page...", 1000);
		wfbuilder.refresh_current_page();
	}
	self.close = function(id) {
		var $iframe = self.opened_files()[id()].crsaPage().$iframe;
		wfbuilder.setSelectedPage($iframe);
		wfbuilder.close_current_page();
	}
	self.save = function() {
		wfbuilder.save_current_page();
	}
	self.duplicate_page = function() {
		wfbuilder.duplicate_current_page();
	}
	self.edit_code = function() {
		wfbuilder.toggleEditCode();
	}

	self.do_test_mode = function() {
		old_val = self.opened_files()[self.active_file()].state.t_m();
		self.opened_files()[self.active_file()].state.t_m(!old_val);
	};
	self.do_js_en = function() {
		old_val = self.opened_files()[self.active_file()].state.js_en();
		self.opened_files()[self.active_file()].state.js_en(!old_val);
	};
	self.do_css_en = function() {
		old_val = self.opened_files()[self.active_file()].state.css_en();
		self.opened_files()[self.active_file()].state.css_en(!old_val);
	};
}
var cv_h = new canvas_handler();
var tt_h = new title_handler();

function statusBar_handler() {
	var self = this;

	self.elList = ko.observableArray([{}]);
	self.cur_id = ko.observable(null);
	self.max_width = ko.observable(100);

	self.update = function(pgId) {
		if (!pgId) {
			self.elList([]);
			self.cur_id(null);
			return;
		}
		
		var isIn = false;
		for (var i = 0 ; i < self.elList().length ; i ++) {
			var sb_el = self.elList()[i];
			if (sb_el.pgId == pgId) {
				isIn = true;
				self.cur_id(i);
				break;
			}
		}
		if (isIn) return;

		self.elList([]);
		var pgel = getPgNodeByPgId(pgId);
		do {
			var par = {};
			par.pgId = pgel.pgId;
			par.name = getElementName(pgel.get$DOMElement(), null, false, true, false, true);

			self.elList.unshift(par);

			pgel = pgel.parent;
		} while(pgel.closingTag != "html");

		self.cur_id(self.elList().length - 1);

		var bar = $(".status-bar");
		self.max_width(Math.floor( (bar.width() - 6) / self.elList().length));
	}

	self.select = function(id) {
		var pgId = self.elList()[id()].pgId;
		var $el = getPgNodeByPgId(pgId).get$DOMElement();
		wfbuilder.selectElement($el);
	}

	self.hover = function(id) {
		var pgId = self.elList()[id()].pgId;
		var $el = getPgNodeByPgId(pgId).get$DOMElement();
		wfbuilder.highlightElement($el);
	}
}
var sb_h = new statusBar_handler();

function om_handler() {
	var self = this;

	self.tb_name = "";
	self.added_cols = ko.observableArray([]);
	self.child_cols = ko.observableArray([]);
	self.cur_col = ko.observable(-1);

	self.addCol = function() {
		if (self.cur_col() == -1)
			return;
		self.added_cols.push({id: self.cur_col(), origin: false});
		self.child_cols()[self.cur_col()].added(true);

		self.cur_col(-1);
	}

	self.onCancel = function(id) {
		self.child_cols()[self.added_cols()[id()].id].added(false);
		self.added_cols.splice(id(), 1);
	}
}

function oo_handler(parID) {
	var self = this;

	self.tb_name = "";
	self.added_cols = ko.observableArray([]);
	self.child_cols = ko.observableArray([]);
	self.cur_col = ko.observable(-1);
	self.conflicts = ko.observable(0);

	var par_rec = ab_h.t_c_list()[parID];

	var update_conflicts = function() {
		var columns = [];
		for (var i in self.added_cols()) {
			var rec = self.child_cols()[self.added_cols()[i].id];
			columns.push(rec.attribName);
		}
		if (columns.length == 0) {
			self.conflicts(0);
			return;
		}
		dbService.get_valueList(par_rec.idEnt, columns, function(record) {
			var tmp = [];
			for (var i = 0 ; i < record.length ; i ++) {
				for (var j = 0 ; j < tmp.length; j ++) {
					var same = true;
					for (key in record[i]) {
						if (record[i][key] != tmp[j][key]) same = false;
					}
					if (same) break;
				}
				if (j == tmp.length) {
					tmp.push(record[i]);
				}
			}
			self.conflicts(record.length - tmp.length);
			console.log(self.conflicts());
		});
	}

	self.addCol = function() {
		if (self.cur_col() == -1)
			return;
		self.added_cols.push({id: self.cur_col(), origin: false});
		self.child_cols()[self.cur_col()].added(true);

		self.cur_col(-1);

		update_conflicts();
	}

	self.onCancel = function(id) {
		self.child_cols()[self.added_cols()[id()].id].added(false);
		self.added_cols.splice(id(), 1);

		update_conflicts();
	}
}

function recentFile_handler() {
	var self = this;
	
	self.list = ko.observableArray([]);
	var maxCnt = 10;

	var retrieve_recentFiles = function() {
		var list = JSON.parse(localStorage.getItem('pgrecentFiles'));
		if (!list)
			return;

		for (var i = 0 ; i < list.length ; i ++) {
			list[i].sticky = ko.observable(list[i].sticky);
		}

		self.list(list);
	}
	var update_recendFiles = function() {
		localStorage.setItem('pgrecentFiles', JSON.stringify(self.list()));
	}

	var raiseTop = function(id) {
		var raiseFile = rf_h.list()[id];
		rf_h.list.splice(id, 1);
		rf_h.list.unshift(raiseFile);

		update_recendFiles();
	}

	self.addUrl = function(url) {
		for (var i = 0 ; i < self.list().length ; i ++) {
			if (self.list()[i].file == url) {
				raiseTop(i);
				return;
			}
		}

		if (self.list().length == maxCnt)
			self.list.pop();
		self.list.unshift({file: url, project: false, sticky: ko.observable(false)});

		update_recendFiles();
	}
	self.openUrl = function(id) {
		var url = self.list()[id()].file;
		wfbuilder.open_recent(url);
	}
	self.clearList = function() {
		for (var i = 0 ; i < self.list().length ; i ++) {
			if (self.list()[i].sticky())
				continue;

			self.list.splice(i--, 1);
		}
		update_recendFiles();
	}
	self.get_sticky = function(id) {
		var cur = self.list()[id()].sticky();
		self.list()[id()].sticky(!cur);

		update_recendFiles();
	}

	retrieve_recentFiles();
}

var rf_h = new recentFile_handler();
su_h.rf_h = rf_h;