
var mainModule = function() {

	var $wfbpanel = $('.wfb-panel');
	var $titlebar = $('.titlebar');
//	var $alert = $('.wfb-alert');

	/*
		name: go_startup
		parameter: none
		return: none
		desc: initialize the whole document and append 'title bar','setting bar' and
		 'startup buttons'
	*/
	this.go_startup = function() {
		this.init();

		var html = html_temp.title_bar;
		$titlebar.append(html);
		ko.applyBindings(tt_h, $(".titlebar")[0]);
		
		html = html_temp.startup_panel;
		$wfbpanel.append(html);

		var idWfClass = su_h.idWfClass();
		ko.applyBindings(su_h, $(".startup-panel")[0]);

		su_h.idWfClass(idWfClass);		/* without this expression, the 'select' tag of 'wfClsDisplayName' has the value of ''
										so the 'idWfClass' value is not affected to 'select' tag */
	};

	/*
		name: init
		parameter: none
		return: none
		desc: initialize the whole document and event handlers
	*/
	this.init = function() {
		$titlebar.empty();
		$wfbpanel.empty();

//		delete su_h;
		delete tt_h; delete cv_h;
		delete ab_h;
//		su_h = new startup_handler();
		cv_h = new canvas_handler();
		tt_h = new title_handler();
		ab_h = new ab_handler();
	};
	
	/*
		name: create_new_page
		parameter: 
			boolean from_startup: if this function is not invoked from 'startup' panel, that is
								there were already opened files, it must be processed with
								different content
		return: none
		desc:
			from_startup->true: appends 'ab', 'pc' panel and canvas panel, then, creates a new page
			from_startup->false: 
	*/
	this.create_new_page = function(from_startup) {
		if (!from_startup)
			return;

		ko.cleanNode($(".startup-panel")[0]);
		$wfbpanel.empty();

		var html = html_temp.ab_panel + html_temp.canvas_panel + html_temp.pc_panel;
		$wfbpanel.append(html);

		cv_h.opened_files.removeAll();
		cv_h.opened_files.push({
			name: "untitled.html",
			active: ko.observable(true),
			state: {
				width: ko.observable(1024),
				t_m: ko.observable(true),
				js_en: ko.observable(true),
				css_en: ko.observable(true)
			}
		});

		cv_h.active_file(0);
		tt_h.current_title(cv_h.opened_files()[0].name + " - ");	// sets title to current file name + '-' + 'Web Form Builder'

		/* Get root table data */
		if (service.is_connected() && service.is_root_table_set()) {
			service.get_root_table(function(recordset) {

				ab_h.t_c_list.push(recordset[0]);

				/* Adds a root table element to db control tree view */
				$("div#app_").addClass("tree");
				var html = "<li data-bind=\"css: t_c_list()[0].attribAttributeType == 1 ? 'branch': ''\">\
								<i class=\"indicator glyphicon\" data-bind=\"if: t_c_list()[0].attribAttributeType == 1,css: closedClass, click: function(data, event) { expand(0, data, event)}\"></i>\
								<span>\
									<span class=\"fa\" data-bind=\"css: t_c_list()[0].attribAttributeType == 1 ? attrib_icons[t_c_list()[0].entType - t_c_list()[0].attribAttributeType] : attrib_icons[t_c_list()[0].attribAttributeType]\"></span>\
									<span data-bind=\"text: t_c_list()[0].attribName\"></span>\
								</span>\
							</li>";
				$("div#app_").append(html);

				ko.applyBindings(ab_h, $("div#app_").children()[1]);
			});
		}

		ko.applyBindings(ab_h, $(".ab-panel")[0]);
		ko.applyBindings(cv_h, $(".canvas")[0]);
	};

	/*
		name: close_current_page
		parameter: none
		return: none
		desc: close current opened page, if it was alone, then it is navigated to 'startup' panel 
	*/
	this.close_current_page = function() {
		if (cv_h.opened_files().length > 0) {
			return;
		}

		/* If it was alone opened file, clears event handler that was already applied.
		    Unless, the dom components such as 'titlebar', 'ab-panel' will be data-binded twice or more
		    because already applied view models cannot distinguish new components from older one as 
		    they have same property:id, class etc */
		ko.cleanNode($(".titlebar")[0]);
		ko.cleanNode($(".canvas")[0]);
		ko.cleanNode($(".ab-panel")[0]);
		ko.cleanNode($(".pc-panel")[0]);

		this.go_startup();
	}

	/*
		name: show_options_modal
		parameter: none
		return: none
		desc: show a modal dialog of 'options' content
	*/
	this.show_options_modal = function() {
		$options = $(comp_modals.options);

		$options.on('hidden.bs.modal', function(event) {
			$(event.target).remove();
		});
		$options.modal();
	}

	/*
		name: show_alert
		parameter:
			type: 0:'success', 1:'info', 2: 'warning'
			msg: message content to be shown
		return: none
		desc: shows a bootstrap alert to notice users info: 'success', 'failed', 'warning' etc
	*/
/*	this.show_alert = function(type, msg) {

		if (type > 2 || type < 0) {
			console.log("invalid alert type");
			return;
		}

		var type_list = {
			0: 'success',
			1: 'info',
			2: 'warning'
		}

		var alert_ob = $("<div class=\"alert\"></div>");
		alert_ob.addClass("alert-" + type_list[type]);
		alert_ob.text(msg);
		$alert.append(alert_ob);
	}*/
}

var wfbuilder = new mainModule();