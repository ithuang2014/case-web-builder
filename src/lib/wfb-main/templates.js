
var html_temp = {
	title_bar:
		"<div class=\"tb-left-menu pull-left\">\
			<div class=\"app-logo-menu dropdown\">\
				<i class=\"fa fa-openid dropdown-toggle\" data-toggle=\"dropdown\"></i>\
			<!-- ko if: current_state()==\"ws\" -->\
				<ul class=\"dropdown-menu\">\
					<li>Create new page</li>\
					<li>Edit existing page</li>\
					<li>Edit login page</li>\
					<li>Edit case page</li>\
					<li class=\"divider\"></li>\
					<li data-bind=\"event: {click: save}\">Save page</li>\
					<li data-bind=\"event: {click: save_as}\">Save as</li>\
					<li>Duplicate</li>\
					<li class=\"divider\"></li>\
					<li data-bind=\"event: {click: close}\">Close</li>\
					<li class=\"divider\"></li>\
					<li>Database settings</li>\
					<li data-bind=\"event: {click: show_options_modal}\">Options</li>\
					<li class=\"divider\"></li>\
					<li>Publish pages to a folder</li>\
					<li class=\"divider\"></li>\
					<li data-bind=\"event: {click: exit}\">Exit</li>\
				</ul>\
			<!-- /ko -->\
			</div>\
		<!-- ko if: current_state()==\"ws\" -->\
			<div class=\"titlebar-divider\"></div>\
			<div class=\"pg-concerned\">\
				<i class=\"fa fa-floppy-o\" data-bind=\"event: {click: save}\"></i>\
				<i class=\"fa fa-file-text-o\"></i>\
				<i class=\"fa fa-folder-open-o\"></i>\
			</div>\
			<div class=\"titlebar-divider\"></div>\
			<div class=\"redo-undo\">\
				<i class=\"fa fa-undo\"></i>\
				<i class=\"fa fa-repeat\"></i>\
			</div>\
			<div class=\"titlebar-divider\"></div>\
			<div class=\"help dropdown\">\
				<i class=\"fa fa-question-circle-o dropdown-toggle\" data-toggle=\"dropdown\"></i>\
				<ul class=\"dropdown-menu\">\
					<li>Online Tutorials</li>\
					<li>Online Support</li>\
					<li>Community</li>\
					<li class=\"divider\"></li>\
					<li>About Web Form Builder</li>\
				</ul>\
			</div>\
			<div class=\"titlebar-divider\"></div>\
		<!-- /ko -->\
		</div>\
		<div class=\"title\" data-bind=\"text: current_title()\">\
			<span>Web Form Builder</span>\
		</div>\
		<div class=\"tb-right-menu pull-right\">\
			<i class=\"fa fa-window-minimize\" data-bind=\"event: {click: minimize}\"></i>\
			<i class=\"fa fa-times\" data-bind=\"event: {click: exit}\"></i>\
		</div>",
	startup_panel: 
		"<div class=\"startup-panel\">\
			<div class=\"setting-bar dropdown\">\
				<a href=\"#\" class=\"db-setting dropdown-toggle\" data-toggle=\"dropdown\">\
					<b>Database</b><span class=\"caret\"></span>\
				</a>\
				<ul class=\"dropdown-menu\">\
					<li class=\"input-group input-group-sm\">\
						<span class=\"input-group-addon\"><i class=\"fa fa-globe fa-1-5x\"></i></span>\
						<input class=\"form-control\" type=\"text\" placeholder=\"SQL server url\" data-bind=\"textInput: s_url, disable: connected\">\
					</li>\
					<li class=\"input-group input-group-sm\">\
						<span class=\"input-group-addon port\">Port</span>\
						<input class=\"form-control\" type=\"text\" placeholder=\"Port\" data-bind=\"textInput: port, disable: connected\">\
					</li>\
					<li class=\"input-group input-group-sm\">\
						<span class=\"input-group-addon\"><i class=\"fa fa-database fa-1-5x\"></i></span>\
						<input class=\"form-control\" type=\"text\" placeholder=\"Database name\" data-bind=\"textInput: db_name, disable: connected\">\
					</li>\
					<li class=\"input-group input-group-sm\">\
						<span class=\"input-group-addon\"><i class=\"fa fa-user-circle fa-lg\"></i></span>\
						<input class=\"form-control\" type=\"text\" placeholder=\"User name\" data-bind=\"textInput: user, disable: connected\">\
					</li>\
					<li class=\"input-group input-group-sm\">\
						<span class=\"input-group-addon\"><i class=\"fa fa-key fa-lg\"></i></span>\
						<input class=\"form-control\" type=\"password\" placeholder=\"Password\" data-bind=\"textInput: pwd, disable: connected\">\
					</li>\
					<li class=\"input-group input-group-sm\">\
						<div class=\"onoffswitch\">\
							<input id=\"preview-switch\" type=\"checkbox\" name=\"onoffswitch\" class=\"onoffswitch-checkbox\" data-bind=\"checked: connected\">\
							<label class=\"onoffswitch-label\" for=\"preview-switch\"></label>\
						</div>\
						<div class=\"remember-me\">\
							<input id=\"rm-input\" type=\"checkbox\" class=\"\" data-bind=\"checked: rem_me, enable: connected\">\
							<label class=\"remember-me-label\" for=\"rm-input\">Remember me</label>\
						</div>\
					</li>\
					<li class=\"divider\"></li>" + 
					/*
					<li class=\"input-group-sm\">\
						<select class=\"form-control\" id=\"catalog\">\
							<option disabled selected>Select Catalog</option>\
						</select>\
					</li>\	*/
					"<li class=\"input-group-sm\">\
						<select class=\"form-control\" id=\"table\" data-bind=\"enable: wfClsDisplayName().length > 0, value: idWfClass\">\
							<option disabled value=\"-1\">wfClsDisplayName</option>\
							<option disabled>---------</option>\
							<!-- ko foreach: wfClsDisplayName -->\
								<option data-bind=\"text: $data.wfClsDisplayName, value: $data.idWfClass\"></option>\
							<!-- /ko -->\
						</select>\
					</li>\
					<li class=\"input-group-sm\">\
						<div class=\"container-fluid\">\
							<button type=\"button\" class=\"btn btn-primary btn-sm col-xs-5 col-xs-offset-1\" data-bind=\"event: {click: save_db_setting}\">Save</button>\
							<button type=\"button\" class=\"btn btn-primary btn-sm col-xs-5 col-xs-offset-1\">Cancel</button>\
						</div>\
					</li>\
				</ul>\
				<a href=\"#\" class=\"options\" data-bind=\"event: {click: show_options_modal}\"><b>Options</b></a>\
			</div>\
			<div class=\"su-buttons\">\
				<a href=\"#\" class=\"create-new-page\" data-bind=\"event: {click: create_new_page}\"><b>Create New Page</b></a>\
				<a href=\"#\" class=\"edit-existing-page\" data-bind=\"event: {click: edit_existing}\"><b>Edit Existing Page</b></a>\
				<a href=\"#\" class=\"edit-login-page\" data-bind=\"event: {click: edit_login}\"><b>Edit Login Page</b></a>\
				<a href=\"#\" class=\"edit-case-page\" data-bind=\"event: {click: edit_case}\"><b>Edit Case Page</b></a>\
			</div>\
		</div>",
	ab_panel:
		"<div class=\"wfb-comp ab-panel\">\
			<ul class=\"nav nav-tabs\">\
				<li class=\"active col-xs-6\"><a data-toggle=\"tab\" href=\"#app_\">Application</a></li>\
				<li class=\"col-xs-6\"><a data-toggle=\"tab\" href=\"#bootstrap_\">Bootstrap</a></li>\
			</ul>\
			<div class=\"tab-content\">\
				<div id=\"app_\" class=\"tab-pane active\">\
					<div class=\"no-db-controls\" data-bind=\"if: t_c_list().length == 0\">No db connection!</div>\
				</div>\
				<div id=\"bootstrap_\" class=\"tab-pane\">\
					<div id=\"crsa-elements\" class=\"crsa-panel crsa-search-panel\">\
						<div class=\"header\"></div>\
						<div class=\"content\"></div>\
					</div>\
				</div>\
			</div>\
		</div>",
	pc_panel: 
		"<div class=\"wfb-comp pc-panel\">\
			<ul class=\"nav nav-tabs\">\
				<li class=\"active col-xs-6\"><a data-toggle=\"tab\" href=\"#prop_\">Property</a></li>\
				<li class=\"col-xs-6\"><a data-toggle=\"tab\" href=\"#css_\">CSS</a></li>\
			</ul>\
			<div class=\"tab-content\">\
				<div id=\"prop_\" class=\"tab-pane active\">\
				</div>\
				<div id=\"css_\" class=\"tab-pane\">\
					<div id=\"crsa-rules\" class=\"crsa-panel\">\
					</div>\
				</div>\
			</div>\
		</div>",
	canvas_panel: 
		"<div class=\"canvas\">\
			<div class=\"canvas-tab\" data-bind=\"visible: false\">\
			</div>\
			<div class=\"cv-pages\" data-bind=\"foreach: opened_files\">\
				<div class=\"page\" data-bind=\"css: $data.active?'active':''\">\
					<span class=\"pg-name\" data-bind=\"text: $data.name\"></span>\
					<span class=\"page-change-icon\" data-bind=\"if: $data.state.changed()\">*</span>\
					<div class=\"pg-menu dropdown\">\
						<a href=\"#\" class=\"pg-setting dropdown-toggle\" data-toggle=\"dropdown\">\
							<span class=\"fa fa-chevron-circle-down\"></span>\
						</a>\
						<ul class=\"dropdown-menu\">\
							<li data-bind=\"event: {click: $root.save}\">Save</li>\
							<li>Duplicate this page</li>\
							<li data-bind=\"event: {click: $root.refresh}\">Refresh</li>\
							<li data-bind=\"event: {click: $root.close}\">Close</li>\
							<li>Manage properties</li>\
							<li>Edit code</li>\
						</ul>\
					</div>\
					<div class=\"scr-menu pull-right dropdown\">\
						<a href=\"#\" class=\"scr-setting dropdown-toggle badge\" data-toggle=\"dropdown\" data-bind=\"text: $data.state.width() + \'px\'\">\
							<span class=\"caret\"></span>\
						</a>\
						<ul class=\"dropdown-menu\">\
							<!-- ko foreach: $root.scr_menu -->\
								<li data-bind=\"text: $data.content, event: {click: $root.set_scrsize($data.value)}\"></li>\
							<!-- /ko -->\
							<li data-bind=\"text: \'custom / \' + $data.state.width() + \'px\'\"></li>\
							<li class=\"divider\"></li>\
							<li data-bind=\"event: {click: $root.do_test_mode}\">\
								<!-- ko if: $data.state.t_m() -->\
									<i class=\"fa fa-check\"></i>\
								<!-- /ko -->\
								Test mode\
							</li>\
							<li data-bind=\"event: {click: $root.do_js_en}\">\
								<!-- ko if: $data.state.js_en() -->\
									<i class=\"fa fa-check\"></i>\
								<!-- /ko -->\
								Enable Javascript\
							</li>\
							<li data-bind=\"event: {click: $root.do_css_en}\">\
								<!-- ko if: $data.state.css_en() -->\
									<i class=\"fa fa-check\"></i>\
								<!-- /ko -->\
								Enable CSS animation\
							</li>\
						</ul>\
						<a href=\"#\" class=\"pg-close\" data-bind=\"event: {click: $root.close}\">\
							<span class=\"fa fa-times\"></span>\
						</a>\
					</div>\
					<div class=\"content content-size-tablet-landscape\">\
						<iframe class=\"content-iframe\" frameborder=\"0\"></iframe>\
					</div>\
				</div>\
			</div>\
		</div>"
}

var comp_modals = {
	alert:
		"<div class=\"modal fade wfb-modal\" role=\"dialog\">\
			<div class=\"modal-dialog modal-lg\">\
			  <div class=\"modal-content\">\
			    <div class=\"modal-header\">\
			      <button type=\"button\" class=\"close\" data-dismiss=\"modal\">&times;</button>\
			    </div>\
			    <div class=\"modal-body\">\
			    </div>\
			    <div class=\"modal-footer\">\
			    </div>\
			  </div>\
			</div>\
		</div>",
	options:
		"<div class=\"modal fade options\" role=\"dialog\">\
			<div class=\"modal-dialog modal-lg\">\
			  <div class=\"modal-content\">\
			    <div class=\"modal-header\">\
			      <button type=\"button\" class=\"close\" data-dismiss=\"modal\">&times;</button>\
			      <p class=\"modal-title\">Web Form Builder Options</p>\
			    </div>\
			    <div class=\"modal-body\">\
				    <div class=\"checkbox\">\
			            <label class=\"control-label\">\
			                <input type=\"checkbox\" class=\"show-placeholders\">\
			                <b>Show placeholders</b> on empty elements\
			            </label>\
			            <p class=\"help-block\">Empty divs (and similar elements) have height 0px and are thus not visible on the page. Enable this option to apply min-height:100px to empty divs, sections and similar elements. This only affects how elements are shown in Web Form Builder, display\
			                in browser is not affected. Reload pages to apply the setting.</p>\
			        </div>\
			        <div class=\"form-group\">\
			            <label class=\"control-label\" for=\"formInputLocalhost\">Internal Webserver hostname</label>\
			            <input id=\"formInputLocalhost\" class=\"form-control webserver-host\" />\
			            <p class=\"help-block\">Web Form Builder uses internal webserver to access local HTML files. Change the value if you experience problems with the default setting.</p>\
			        </div>\
			        <div class=\"form-group\">\
			            <label class=\"control-label\" for=\"formInputPort\">Internal Webserver ports</label>\
			            <input id=\"formInputPort\" class=\"form-control webserver-port\" />\
			            <p class=\"help-block\">Web Form Builder uses internal webserver to access local HTML files. Select a free port and make sure that incoming connections are not blocked by a firewall. Each form builder window needs a free port. Each subsequent window will look for the first\
			                free port above the one specified here.</p>\
			        </div>\
			        <div class=\"form-group\">\
			            <label class=\"control-label\" for=\"formInputCodeSize\">Font size in Code editors</label>\
			            <input id=\"formInputCodeSize\" class=\"form-control code-size\" />\
			            <p class=\"help-block\">Default is 12px. Don't forget to add px or another unit.</p>\
			        </div>\
			        <div class=\"form-group\">\
			            <label class=\"control-label\" for=\"formInput2\">Code indent size</label>\
			            <select id=\"formInput2\" class=\"form-control html-indent-size\">\
			                <option>1</option>\
			                <option>2</option>\
			                <option>3</option>\
			                <option>4</option>\
			                <option>8</option>\
			            </select>\
			            <p class=\"help-block\">Size of HTML code indent.</p>\
			        </div>\
			    </div>\
			    <div class=\"modal-footer\">\
			      <button type=\"button\" class=\"btn btn-default\" data-dismiss=\"modal\">Cancel</button>\
			      <button type=\"button\" class=\"btn btn-primary\" data-dismiss=\"modal\">Save</button>\
			    </div>\
			  </div>\
			</div>\
		</div>"
}