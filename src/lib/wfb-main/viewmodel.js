var gui = require("nw.gui");

function title_handler() {
	var self = this;

/* current_state: 'ws' then shows all button on title bar
				  'st' then shows only App Logo button without dropdown */
	self.current_state = ko.computed(function() {
		return cv_h.opened_files().length > 0 ? 'ws' : 'st';
	});
	self.current_title = ko.observable("");

	self.exit = function() {
		window.close();
	}
	self.minimize = function() {
		gui.Window.get().minimize();
	}
}

function startup_handler() {
	var self = this;
	
/* db setting variables are defined below */

	self.s_url = ko.observable('');
	self.port = ko.observable('1433');
	self.db_name = ko.observable('aeonv5');
	self.user = ko.observable('sa');
	self.pwd = ko.observable('');
	self.connected = ko.observable(false);
	self.rem_me = ko.observable(false);

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
			if (service.is_connected())
				return;

			/* set connected to 'false' because Toggle button must be toggled
			    after the db connection is succeed */
			self.connected(false);

			config = {
				user: self.user(),
				password: self.pwd(),
				server: self.s_url(),
				database: self.db_name(),
				port: self.port()
			};

			service.connect_db(config, function() {
				self.connected(true);

				service.get_wfCls(function(recordset) {
					self.wfClsDisplayName(recordset);
				});
			}, function() {
				self.connected(false);
			});
 		}
		else {
			self.idWfClass("-1");
			self.wfClsDisplayName([]);
			if (service.is_connected())
				service.disconnect_db();
		}
	});

	/* saves the credential: this operation is valid after db connection is succeed */
	self.rem_me.subscribe(function(value) {
		if (value) {
			service.save_db_credential();
		}
	});

	/* defines observable array for wfClsDisplayName */
	self.wfClsDisplayName = ko.observableArray([]);

	self.idWfClass = ko.observable("-1");

	/* defines a callback function for 'show.bs.dropdown' of db setting dropdown panel 
	self.db_setting_show = function() {
		console.log("asdfasdf");
//		$("a.db-setting.dropdown-toggle").dropdown("toggle");
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

		service.save_idWfClass(self.idWfClass());
	}

	self.show_options_modal = function() {
		wfbuilder.show_options_modal();
	}

	self.retrieve_db_credential = function() {
		var cre = service.get_db_credential();
		
		if (!cre)
			return;

		self.s_url(cre.server);
		self.port(cre.port);
		self.db_name(cre.database);
		self.user(cre.user);
		self.pwd(cre.password);
	}

/* below functions are for the 4 buttons on startup */
	self.create_new_page = function() {
		wfbuilder.create_new_page(true);
	};
	self.edit_existing = function() {

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
	self.openedClass = 'glyphicon-minus-sign';
	self.closedClass = 'glyphicon-plus-sign';
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
		1005: 'fa-calendar'
	}

	/* a storage for db controls, actually tables and columns */
	self.t_c_list = ko.observableArray([]);

	self.expand = function(id, data, event) {
		var tar = $(event.target);
		var par = tar.parent();
		
		tar.toggleClass(self.openedClass + " " + self.closedClass);
		
		/* if the columns of clicked table are already inserted into 't_c_list', then only
		    toggles them and return */
		if (self.t_c_list()[id].childlist != undefined) {
			par.children("ul").eq(0).toggle();
			return;
		}
		
		/* initalize childlist of clicked table */
		self.t_c_list()[id].childlist = [];

		service.get_columns(self.t_c_list()[id], function(recordset) {
			/* get columns of clicked table and stores them into 't_c_list'
			    also stores the their indices into childlist */
			for (i = 0 ; i < recordset.length ; i ++) {
				self.t_c_list()[id].childlist.push(self.t_c_list().length);
				self.t_c_list().push(recordset[i]);
			}
			
			var html = "<ul data-bind=\"foreach: t_c_list()[" + id + "].childlist\">\
							<li data-bind=\"css: $root.t_c_list()[$data].attribAttributeType == 1 ? 'branch': ''\">\
								<!-- ko if: $root.t_c_list()[$data].attribAttributeType == 1 -->\
									<i class=\"indicator glyphicon\" data-bind=\"css: $root.closedClass, click: function(data, event) { $root.expand($data, data, event)}\"></i>\
								<!-- /ko -->\
								<span>\
									<span class=\"fa\" data-bind=\"css: $root.t_c_list()[$data].attribAttributeType == 1 ? $root.attrib_icons[$root.t_c_list()[$data].entType - $root.t_c_list()[$data].attribAttributeType] : $root.attrib_icons[$root.t_c_list()[$data].attribAttributeType]\"></span>\
									<span data-bind=\"text: $root.t_c_list()[$data].attribName\"></span>\
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
	self.opened_files = ko.observableArray([]);
	self.active_file = ko.observable();

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
	};

	self.close = function() {
		self.opened_files.splice(self.active_file(), 1);
		wfbuilder.close_current_page();
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
