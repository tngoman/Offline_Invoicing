const name = require(__dirname + '/package.json').name;
const path = require("path");
const fs = require('fs');
const PDFWindow = require('electron-pdf-window');
const { ipcRenderer, shell } = require('electron');
const electron = require('electron').remote;
const {BrowserWindow}= require('electron').remote;
const dialog = electron.dialog;
const Datastore = require( "nedb" );
const jsPDF = require('jspdf');
const Store = require('electron-store');
const stores = process.env.APPDATA;
const storage = new Store();
const html2canvas = require('html2canvas');
const invoicesDB = name+"/db/invoices.db";
const customersDB = name+"/db/customers.db";
const productsDB = name+"/db/products.db";
const file_path = "\\"+name+"\\files\\";
const nodemailer = require('nodemailer');
const checkServer = require('is-port-reachable');
const Highcharts = require('highcharts');
const year = new Date().getFullYear();
const Swal = require('sweetalert2');
const remote = require('electron').remote;
const app = remote.app; 
let version = require(__dirname + '/package.json').version;
let exec = require('child_process').execFile;
let cloned = $('#invoice_table tr:last').clone();
let data_month = new Date().getMonth();
let charge_vat = false;
let smtp_status = false;
let downloading = false;
let quotes = [];
let invoices = [];
let customers = [];
let products = [];
let invoice = {};
let item = null;
let sending = false;
let symbol = "R";
let settings = {};
let percentage = 0;
let host;
let port;
let user;
let pass;

(function($) {
    $.fn.toJson = function(options) {
        let settings = $.extend({
            stringify : false
        }, options);
        let json = {};
        $.each(this.serializeArray(), function() {
			let name = this.name.replace(/[^\w\s]/gi, '');
            if (name in json) {
                if (!json[name].push)
                    json[name] = [json[name]];
                json[name].push(this.value || '');
            } else
                json[name] = this.value || '';
        });
        if(settings.stringify)
            return JSON.stringify(json);
        else
            return json;
    };
})(jQuery);


let slideNum = $('.page').length,
wrapperWidth = 100 * slideNum,
slideWidth = 100 / slideNum;

$('.wrapper').width(wrapperWidth + '%');
$('.page').width(slideWidth + '%');

let invoiceDB = new Datastore({
    filename: stores+"/"+invoicesDB,
    autoload: true
}),productDB = new Datastore({
    filename: stores+"/"+productsDB,
    autoload: true
}),customerDB = new Datastore({
    filename: stores+"/"+customersDB,
    autoload: true
});


const months    = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function format(amount) {
	return parseFloat(amount).toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')
}



//Check if file directory exists
  if (!fs.existsSync(stores+file_path)) {
    fs.mkdir(stores+file_path, { recursive: true }, (err) => {
		if (err) throw err;
	 });
}

 

$(document).ready(function() {

	loadDashboard();
	showCompanyDetails();	
	getInvoices();
	getCustomers();
	getProducts();
  

//Dashboard click
$('#dash').click(function(){
	loadDashboard();
});


//Create invoice click
  $('#create_btn').click(function(){
	$('#create_invoice').get(0).reset();
	$('#action').val('create_invoice');
	$('#title').text('INVOICE');	
	$('#action_create_invoice').val('Create Invoice');
	$('#invoice_items').empty();
	calculateTotal();
	$("#invoice_status").empty();
	$("#invoice_status").html(`<option value="unpaid">Unpaid</option><option value="paid">Paid</option>`);
	$('#date').val(moment().format('YYYY-MM-DD'));
	$('#due_date').val(moment().format('YYYY-MM-DD'));
	cloned.clone().appendTo('#invoice_table');

	showCompanyDetails();		
  });


//Create quote click
  $('#create_quote').click(function(){
	$('#create_invoice').get(0).reset();
	$('#action').val('create_quote');
	$('#title').text('QUOTE');	
	$('#action_create_invoice').val('Create Quote');
	$('#invoice_items').empty();
	calculateTotal();
	$("#invoice_status").empty();
	$("#invoice_status").html(`<option value="pending">Pending</option>`);
	$('#date').val(moment().format('YYYY-MM-DD'));
	$('#due_date').val(moment().format('YYYY-MM-DD'));
	cloned.clone().appendTo('#invoice_table');
	showCompanyDetails();	
	let margin = 1 * -100 + '%';
    $('.wrapper').animate({
      marginLeft: margin
	}, 0);
});



//Settings click
$('.settings').click(function() {
	if(settings != undefined) {

		if(settings.vat_percentage != undefined) {
			$('#vat_percentage').val(settings.vat_percentage);
		}

		if(settings.charge_vat != undefined) {
			settings.charge_vat == 1 ? $("#charge_vat").prop("checked", true) : $("#charge_vat").prop("checked", false);
		}

		if(settings.logo != '') {
			$('#current_img').html(`<img src="${ stores + file_path + settings.logo}"/>`);
		}

		if(settings.symbol != undefined) {
			$('#symbol').val(settings.symbol);
		}

		if(settings.footer != undefined) {
			$('#invoice_footer').val(settings.footer);
		}

		else {
			$('#symbol').val('$');
		}
	}	
	
	
	let smtp = storage.get('smtp');

	if(smtp != undefined) {
		$('#smtp_host').val(smtp.host);
		$('#smtp_port').val(smtp.port);
		$('#smtp_user').val(smtp.user);
		$('#smtp_pass').val(smtp.pass);
		smtp.default == 1 ? $("#smtp").prop("checked", false) : $("#smtp").prop("checked", true);
	}
	else {
		$("#smtp").prop("checked", true);
	}


	$('#settings').modal({ backdrop: 'static', keyboard: false });
});



//Select logo click
$('.select_logo').click(function(e) {	
	e.preventDefault();	
	dialog.showOpenDialog({
	properties: ['openFile', 'multiSelections']
}, function (files) {
	if (files !== undefined) {
		const filePath = files[0];
		const fileName = path.basename(filePath);
		storage.set('settings.logo', filePath.replace(/^.*[\\\/]/, ''));
		fs.copyFileSync(filePath, stores + file_path + fileName);
		showLogo(fileName);	
		}
	});

});



//Create product click
$('.create_product').click(function() {	
	$("#add_product").get(0).reset();
	$('#action_add_product').val('Add Product');
	$('#create_product').modal({ backdrop: 'static', keyboard: false });
	
});



//Save product click
$("#action_add_product").click(function(e) {
	e.preventDefault();

	if($('#product_name').val() == '') {
		Swal.fire(
			'No Item Name!',
			'Please enter the name of the item!',
			'error'
		  );
		return false;
	}

	if($('#product_price').val() == '') {
		$('#product_price').val(0);
	}
	

	let formData =  $("#add_product").toJson(); 
	actionAddProduct(formData);
});



//Save customer click
$('.create_customer').click(function() {	
	$("#add_customer").get(0).reset();
	$('#action_create_customer').val('Create Customer');
	$('#create_customer').modal({ backdrop: 'static', keyboard: false });
});



//Craete customer click
$("#action_create_customer").click(function(e) {
	e.preventDefault();

	if($('#customerName').val() == '') {
		Swal.fire(
			'No Customer Name!',
			'Please enter a customer name!',
			'error'
		  );
		return false;
	}

	let formData =  $("#add_customer").toJson(); 		
	actionCreateCustomer(formData);
});



//Open select product modal
$(document).on('click', ".item-select", function(e) {
	   e.preventDefault;
	   item = $(this);
	   $('#insert').modal({ backdrop: 'static', keyboard: false });
	   return false;

   });
   


//Open select customer modal
   $(document).on('click', ".select-customer", function(e) {
	   e.preventDefault;
	   let customer = $(this);
	   $('#insert_customer').modal({ backdrop: 'static', keyboard: false });
	   return false;
 });



//Menu item click
 $('a.scrollitem').click(function() {
	$('a.scrollitem').removeClass('selected');
	$(this).addClass('selected');
	let slideNumber = $($(this).attr('href')).index('.page'),
	margin = slideNumber * -100 + '%';
	$('.wrapper').animate({
	marginLeft: margin
	}, 100);

	return false;
});



//Cancel button click
   $('#cancel').click(() => {
	let margin = 2 * -100 + '%';
    $('.wrapper').animate({
      marginLeft: margin
	}, 200);
  });



//Exit click
  $('#quit').click(function(){
	Swal.fire({
		title: 'Are you sure?',
		text: "You are about to close the application.",
		icon: 'warning',
		showCancelButton: true,
		confirmButtonColor: '#d33',
		cancelButtonColor: '#3085d6',
		confirmButtonText: 'Close Application'
	  }).then((result) => {    

		if (result.value) {
			if(sending) {
				Swal.fire(
					'Still sending!',
					'Please wait for the email to be delivered.',
					'error'
				  );
			}
			else {
				ipcRenderer.send('app-quit', '');
			}		
	   }
   });
});



  function showCompanyDetails() {
	settings = storage.get('settings');
	if(settings != undefined) {
		$('#company_name').val(settings.name);
		$('#company_email').val(settings.email);
		$('#company_address').val(settings.address);
		$('#company_town').val(settings.town);
		$('#company_vat').val(settings.vat);
		$('#company_phone').val(settings.phone);

		if(settings.symbol != undefined) {
			symbol = settings.symbol;
		}

		if(settings.charge_vat != undefined) {
			charge_vat = settings.charge_vat == 1 ? true : false;
			percentage = parseInt(settings.vat_percentage);
		}

		if(settings.logo != '') {
			$('#logo').html(`<img src="${ stores + file_path + settings.logo}" class="img-responsive"/>`);
		}		
	}	
	$('#price_currency, #sub_currency, #invoice_sub_currency, #invoice_discount_currency, #shipping_currency, #invoice_total_currency, #vat_currency, #product_price_currency').text(symbol);

	if(charge_vat) {
		$('#vat_line').show();
	}
	else {
		$('#vat_line').hide();
	}

	calculateTotal();
  }

  


  function loadDashboard (){
	
	let group_by = 'month';
	let unpaid_num = 0;
	let unpaid_val = 0;
	let quote_num = 0;
	let quote_val = 0;
	let paid_num = 0;
	let paid_val = 0;
	let total_num = 0;
	let total_val = 0;
	let year_invoices = {};
	let year_paid = {};
	let year_unpaid = {};
	let month_invoices = {};
	let month_paid = {};
	let month_unpaid = {};
	let paid = [];
	let unpaid = [];
	let categories = [];
	let values = [];

	invoiceDB.find( {}, function ( err, docs ) {
	   	  if(docs.length > 0) {		 

			let this_year = docs.filter(doc => {
				return year == new Date(doc.invoice_date).getFullYear(); 
			});

				
			this_year.forEach((item, i) => {

				let month = parseInt(item.invoice_date.split('-')[1]);

				if(item.action == "create_quote") {
					quote_num += 1;
					quote_val += parseFloat(item.invoice_total);
				}


				if(item.action == "create_invoice" && item.invoice_status == 'unpaid' ) {
					unpaid_num += 1;
					unpaid_val += parseFloat(item.invoice_total);

					if(year_unpaid[month] == undefined) {
						year_unpaid[month] = parseFloat(item.invoice_total);
					}
					else {
						year_unpaid[month] += parseFloat(item.invoice_total);			
					}
				}


				if(item.invoice_status == 'paid') {
					paid_num += 1;
					paid_val += parseFloat(item.invoice_total);

					if(year_paid[month] == undefined) {
						year_paid[month] = parseFloat(item.invoice_total);
					}
					else {
						year_paid[month] += parseFloat(item.invoice_total);			
					}
				}
 

				if(item.action == "create_invoice") {
					total_num += 1;
					total_val += parseFloat(item.invoice_total);
					
					if(year_invoices[month] == undefined) {
						year_invoices[month] = parseFloat(item.invoice_total);
					}
					else {
						year_invoices[month] += parseFloat(item.invoice_total);
					}
				}				
			});



			if(Object.keys(year_invoices).length == 1) {
				group_by = 'day';	 			
				this_year.forEach((item, i) => {
						let day = parseInt(item.invoice_date.split('-')[2]);
						data_month = parseInt(item.invoice_date.split('-')[1]);

						if(item.invoice_status == 'paid') {		
							if(month_paid[day] == undefined) {
								month_paid[day] = parseFloat(item.invoice_total);
							}
							else {
								month_paid[day] += parseFloat(item.invoice_total);			
							}
						}

						if(item.invoice_status == 'unpaid') {		
							if(month_unpaid[day] == undefined) {
								month_unpaid[day] = parseFloat(item.invoice_total);
							}
							else {
								month_unpaid[day] += parseFloat(item.invoice_total);			
							}
						}

						if(item.action == "create_invoice") {
							if(month_invoices[day] == undefined) {
								month_invoices[day] = parseFloat(item.invoice_total);
							}
							else {
								month_invoices[day] += parseFloat(item.invoice_total);
							}
						}
					
					});

					for(key in month_invoices) {
						categories.push(key);
						values.push(month_invoices[key]);

						if(month_paid[key] != undefined) {
							paid.push(month_paid[key]);
						}
						else {
							paid.push(0);
						}

						if(month_unpaid[key] != undefined) {
							unpaid.push(month_unpaid[key]);
						}
						else {
							unpaid.push(0);
						}
					}				
				}		 
				
		 	else {
					for(key in year_invoices) {
						categories.push(key);
						values.push(year_invoices[key]);

						if(year_paid[key] != undefined) {
							paid.push(year_paid[key]);
						}
						else {
							paid.push(0);
						}

						if(year_unpaid[key] != undefined) {
							unpaid.push(year_unpaid[key]);
						}
						else {
							unpaid.push(0);
						}
					}					
			
				}

				let group = [];
				let mon = months[data_month - 1];

				if(group_by == 'day') {
					categories.forEach(i => {
						group.push(i + ' ' + mon);
					});
				}
				else {
					categories.forEach(i => {
							group.push(months[i - 1]);
					});
				}

				Highcharts.chart('year_area', {
					title: {
						text: null
					},
					xAxis: {
						categories: group
					},
					yAxis: {
						title: {
							text: null
						}
					}, 
					labels: {
						items: [{
							html: null,
							style: {
								left: '50px',
								top: '18px',
								color: (  
									Highcharts.defaultOptions.title.style &&
									Highcharts.defaultOptions.title.style.color
								) || 'black'
							}
						}]
					},
					series: [{
						type: 'column',
						name: 'Paid',
						color: Highcharts.getOptions().colors[2],
						data: paid
					}, {
						type: 'column',
						name: 'Unpaid',
						color: Highcharts.getOptions().colors[0],
						data: unpaid
					}, {
						type: 'spline',
						name: 'Total',
						data: values,
						marker: {
							lineWidth: 2,
							lineColor: Highcharts.getOptions().colors[3],
							fillColor: 'white'
						}
					}]
				});



				Highcharts.chart('pie', {
					chart: {
						plotBackgroundColor: null,
						plotBorderWidth: null,
						plotShadow: false,
						type: 'pie'
					},
					title: {
						text: group_by == 'day' ? months[data_month-1] + ' ' + year : year
					},
					tooltip: {
						pointFormat: '{series.name}: <b>{point.percentage:.1f}%</b>'
					},
					accessibility: {
						point: {
							valueSuffix: '%'
						}
					}, 
					plotOptions: {
						pie: {
							allowPointSelect: true,
							showInLegend: true,
							cursor: 'pointer',
							dataLabels: {
								enabled: false,
								format: '<b>{point.name}</b>: {point.percentage:.1f} %'
							}
						}
					},
					series: [{
						name: 'Paid vs Unpaid',
						colorByPoint: true,
						data: [{
							name: 'Paid',
							y: parseInt(paid_val),
							color: Highcharts.getOptions().colors[2] 
						}, {
							name: 'Unpaid',
							y: parseInt(unpaid_val),
							color: Highcharts.getOptions().colors[5],
							sliced: true,
							selected: true
						}  ]
					}]
				});

 

				$('#quotes .numbers').text(quote_num);
				$('#all .numbers').text(total_num);
				$('#paid .numbers').text(paid_num);
				$('#unpaid .numbers').text(unpaid_num);
				$('#quotes .values').text(symbol + format(quote_val));				
				$('#all .values').text(symbol + format(total_val));				
				$('#paid .values').text(symbol + format(paid_val));				
				$('#unpaid .values').text(symbol + format(unpaid_val));
							 	 
		 }   
	});
  }




  function getInvoices(){
	invoiceDB.find( {}, function ( err, docs ) {
		invoices = [];
		quotes = [];
		
       if(docs.length > 0){				
			quotes = docs.filter(function(doc) {  
					return doc.action == "create_quote";		   
			});
			invoices = docs.filter(function(doc) {  
				return doc.action == "create_invoice";		   
		});
	   }
	   manageQuotes();
	   manageInvoices();	   
	});
  }




  function getProducts(){
	productDB.find( {}, function ( err, docs ) {
      products = docs;
	   manageProducts(); 
	});
  }



  function getCustomers(){
	customerDB.find( {}, function ( err, docs ) {
      customers = docs;
	   manageCustomers(); 
	});
  }



  
  function manageInvoices () {

	let counter = 0;
	let invoice_list = '';

	$('#invoiceList').DataTable().destroy();
	$('#invoice_list').html('');
    

	invoices.forEach((invoice, index) => {
			
			counter++;

			invoice_list += `<tr>
			<td>${invoice._id}</td>
            <td>${invoice.customer_name}</td>
            <td>${symbol + format(invoice.invoice_total)}</td>
			<td>${invoice.invoice_date}</td>
			<td>${invoice.invoice_due_date}</td>
			<td>${capitalize(invoice.invoice_status)}</td>
			<td class="nobr"><span class="btn-group"><button onClick="$(this).openEmail(1, ${index})" class="btn btn-default btn-sm"><span class="glyphicon glyphicon-envelope"></span> Send</button><button onClick="$(this).openPDF(${invoice._id})" class="btn btn-warning btn-sm"><span class="glyphicon glyphicon-eye-open"></span> PDF</button><button onClick="$(this).editInvoice(${index})" class="btn btn-success btn-sm"><span class="glyphicon glyphicon-edit"> Edit</span></button><button onClick="$(this).deleteInvoice(${invoice._id})" class="btn btn-white btn-sm"><span class="glyphicon glyphicon-trash"></span> Delete</button></span></td></tr>`;
		     
            if(counter == invoices.length) {

                $('#invoice_list').html(invoice_list); 
                
                $('#invoiceList').DataTable({
                    "order": [[ 0, "desc" ]]
                    , "autoWidth":false
                    , "info":true
                    , "JQueryUI":true
                    , "ordering":true
                    , "paging":true                        
                });                
            } 
	});
	
  }



  function manageQuotes() {

	let counter = 0;
	let quote_list = '';

	$('#quoteList').DataTable().destroy();
	$('#quote_list').html('');    

	quotes.forEach((quote, index) => {
            counter++;
			quote_list += `<tr>
			<td>${quote._id}</td>
            <td>${quote.customer_name}</td>
            <td>${symbol + format(quote.invoice_total)}</td>
			<td>${quote.invoice_date}</td>
			<td>${quote.invoice_due_date}</td>
			<td>${capitalize(quote.invoice_status)}</td>     
			<td class="nobr"><span class="btn-group"><button onClick="$(this).openEmail(2, ${index})" class="btn btn-default btn-sm"><span class="glyphicon glyphicon-envelope"></span> Send</button><button onClick="$(this).openPDF(${quote._id})" class="btn btn-warning btn-sm"><span class="glyphicon glyphicon-eye-open"></span> PDF</button><button onClick="$(this).editQuote(${index})" class="btn btn-success btn-sm"><span class="glyphicon glyphicon-edit"> Edit</span></button><button onClick="$(this).deleteQuote(${quote._id})" class="btn btn-white btn-sm"><span class="glyphicon glyphicon-trash"></span> Delete</button></span></td></tr>`;
		     
            if(counter == quotes.length) {

                $('#quote_list').html(quote_list); 
                
                $('#quoteList').DataTable({
					"order": [[ 0, "desc" ]]
                    , "autoWidth":false
                    , "info":true
                    , "JQueryUI":true
                    , "ordering":true
                    , "paging":true                      
                });                
            } 
	});
  }

 


  function manageProducts () {

	let counter = 0;
	let product_list = '';
	let product_select = '';

	$('#productList').DataTable().destroy();
	$('#productSelect').DataTable().destroy();
	$('#product_list').html('');
	$('#product_select').html('');
	

	products.forEach((product, index) => {
            counter++;
            product_list += `<tr>
            <td>${product.product_name}</td>
            <td>${product.product_desc}</td>
			<td>${symbol + parseFloat(product.product_price).toFixed(2)} </td>
			<td><span class="btn-group"><button onClick="$(this).editProduct(${index})" class="btn btn-warning btn-sm"><span class="glyphicon glyphicon-edit"></span></button><button onClick="$(this).deleteProduct(${product._id})" class="btn btn-danger btn-sm"><span class="glyphicon glyphicon-trash"></span></button></span></td></tr>`;

			product_select += `<tr>
			<td>${product.product_name}</td>
			<td>${product.product_desc}</td>
 			<td>${symbol + parseFloat(product.product_price).toFixed(2)} </td>
			<td><button onClick="$(this).selectProduct(${index})" class="btn btn-block btn-warning btn-sm">Select</button></tr>`;
					     
            if(counter == products.length) {

				$('#product_list').html(product_list); 
				$('#product_select').html(product_select);
                
                $('#productList').DataTable({
                    "order": [[ 1, "desc" ]]
                    , "autoWidth":false
                    , "info":true
                    , "JQueryUI":true
                    , "ordering":true
                    , "paging":true                       
				});
				
				$('#productSelect').DataTable({
                    "order": [[ 1, "desc" ]]
                    , "autoWidth":false
					, "info":true	
                    , "JQueryUI":true
                    , "ordering":true
                    , "paging":true                       
				});
            } 
	});
	
  }




  function manageCustomers () {

	let counter = 0;
	let customer_list = '';
	let customer_select = '';

	$('#customerList').DataTable().destroy();
	$('#customerSelect').DataTable().destroy();
	$('#customer_list').html('');
	$('#customer_select').html('');
	

	customers.forEach((customer, index) => {
            counter++;
            customer_list += `<tr>
            <td>${customer.customer_name}</td>
            <td>${customer.customer_email}</td>
			<td>${customer.customer_phone}</td>
			<td>${customer.customer_person}</td>
			<td><span class="btn-group"><button onClick="$(this).editCustomer(${index})" class="btn btn-warning btn-sm"><span class="glyphicon glyphicon-edit"></span></button><button onClick="$(this).deleteCustomer(${customer._id})" class="btn btn-danger btn-sm"><span class="glyphicon glyphicon-trash"></span></button></span></td></tr>`;

			customer_select += `<tr><td>${customer.customer_name}</td><td>${customer.customer_person}</td><td><span onClick="$(this).selectCustomer(${index})" class="btn btn-sm btn-block btn-warning">Select</span></td></tr>`;
		     
            if(counter == customers.length) {

				$('#customer_list').html(customer_list);
				$('#customer_select').html(customer_select); 
                
                $('#customerList').DataTable({
                    "order": [[ 1, "desc" ]]
                    , "autoWidth":false
					, "info":true
                    , "JQueryUI":true
                    , "ordering":true
                    , "paging":true                       
				});
				
				$('#customerSelect').DataTable({
                    "order": [[ 1, "desc" ]]
                    , "autoWidth":false
					, "info":true
					,"pageLength": 5
                    , "JQueryUI":true
                    , "ordering":true
                    , "paging":false                        
				});				
			  
            } 
	});
	
  }



function showLogo(fileName) {
	$('#current_img').html(`<img src="${ stores + file_path + fileName}"/>`);
}



$.fn.editInvoice = function (i) {
	
	$('#create_invoice').get(0).reset();	
	$('#action_create_invoice').val('Update Invoice');
	$('#action').val('create_invoice');
	$('#title').text('INVOICE: ' + invoices[i]._id);
	$('#invoice_items').empty();

	$("#invoice_status").empty();
	$("#invoice_status").html(`<option value="unpaid">Unpaid</option><option value="paid">Paid</option>`);

	$("#invoice_status option").filter(function() {
		return $(this).val() == invoices[i].invoice_status;
	}).prop("selected", true);

	showDetails(1, i);

	if(Array.isArray(invoices[i].invoice_product)) {
		invoices[i].invoice_product.forEach(function(invoice, index){

			let item = invoiceRows(1, i, index);			
			$('#invoice_items').append(item);
		});
	}
	else {

		let item = invoiceRows(1, i, -1);			
		$('#invoice_items').append(item);
	}

	if(invoices[i].invoice_shipping) {
		$('#invoice_shipping').val(invoices[i].invoice_shipping);
	}

	calculateTotal();

	let margin = 1 * -100 + '%';
    $('.wrapper').animate({
      marginLeft: margin
	}, 200);	
 
  }



  $.fn.openPDF = function (id) {
	const win = new BrowserWindow({ width: 1100, height: 800 }); 
	win.setMenu(null);
	PDFWindow.addSupport(win);	 
	win.loadURL(stores + file_path + id +'.pdf'); 
  }



  $.fn.openEmail = function (group, i) {
	let smtp = storage.get('smtp');

	if(smtp != undefined) {
		if(smtp.default == 0) {
			setDefaultSMTP();
		}
	else {
		host = smtp.host;
		user = smtp.user;
		pass = smtp.pass;
		port = smtp.port;
		}	
	}
	else {
		setDefaultSMTP();
	}

	(async () => {
		smtp_status = await checkServer(port, {host: host});
		$('#smtp_status').html(smtp_status ? 'SMTP Server: <span class="online">Online</span>' : 'SMTP Server: <span class="offline">Offline</span>');
		 
	})();


	if(group == 1) {
		invoice = invoices[i];
	}
	else {
		invoice = quotes[i];
	}

	$('#email_to').val(invoice.customer_email);
	$('#email_from').val(invoice.company_email);
	$('#email_customer').text(group == 1 ? 'Send Invoice to ' + invoice.customer_name : 'Send Quotation to ' + invoice.customer_name);
	$('#email_subject').val(group == 1 ? 'Invoice ' + invoice._id + ' from ' + invoice.company_name : 'Quotation ' + invoice._id + ' from ' + invoice.company_name);
	$('#email_msg').val("Dear " + (invoice.customer_person != '' ? invoice.customer_person : invoice.customer_name) + ", Please find your " + (group == 1 ? 'invoice' : 'quotation') + " attached.  Thank you.");
	$('#send').modal({ backdrop: 'static', keyboard: false });
	
  }



  function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}



  $.fn.editProduct = function (i) {
	$('#product_id').val(products[i]._id);
	$('#product_name').val(products[i].product_name);
	$('#product_desc').val(products[i].product_desc);
	$('#product_price').val(products[i].product_price);
	$('#action_add_product').val('Update Product');
	$('#create_product').modal({ backdrop: 'static', keyboard: false });
  }

 


  $.fn.editCustomer = function (i) {
	$('#customer_id').val(customers[i]._id);
	$('#customerName').val(customers[i].customer_name);
	$('#customerEmail').val(customers[i].customer_email);
	$('#customerAddress_1').val(customers[i].customer_address_1);
	$('#customerAddress_2').val(customers[i].customer_address_2);
	$('#customerPostcode').val(customers[i].customer_postcode);
	$('#customerVat').val(customers[i].customer_vat);
	$('#customerPhone').val(customers[i].customer_phone);
	$('#customerPerson').val(customers[i].customer_person);
	$('#action_create_customer').val('Update Customer');
	$('#create_customer').modal({ backdrop: 'static', keyboard: false });
 }



  $.fn.editQuote = function (i) {

	$('#create_invoice').get(0).reset();
	$('#action_create_invoice').val('Update Quote');
	$('#action').val('create_quote');
	$('#title').text('QUOTE: ' + quotes[i]._id);
	$('#invoice_items').empty();

	$("#invoice_status").empty();
	$("#invoice_status").html(`<option value="pending">Pending</option><option value="accepted">Invoice</option>`);

	$("#invoice_status option").filter(function() {
		return $(this).val() == quotes[i].invoice_status;
	}).prop("selected", true);

	showDetails(2, i);

	if(Array.isArray(quotes[i].invoice_product)) {
		quotes[i].invoice_product.forEach(function(invoice, index){

			let item = invoiceRows(2, i, index);			
			$('#invoice_items').append(item);
		});
	}
	else {

		let item = invoiceRows(2, i, -1);			
		$('#invoice_items').append(item);
	}

	if(quotes[i].invoice_shipping) {
		$('#invoice_shipping').val(quotes[i].invoice_shipping);
	}

	calculateTotal();

	let margin = 1 * -100 + '%';
    $('.wrapper').animate({
      marginLeft: margin
	}, 200);	
 
  }



  
  function showDetails (list, i) {

	let data = {};

	if(list == 1) {
		data = invoices[i];
	}
	else {
		data = quotes[i];
	}

	$('#customer_name').val(data.customer_name);
	$('#customer_email').val(data.customer_email);
	$('#customer_address_1').val(data.customer_address_1);
	$('#customer_address_2').val(data.customer_address_2);
	$('#customer_postcode').val(data.customer_postcode);
	$('#customer_vat').val(data.customer_vat);
	$('#customer_phone').val(data.customer_phone);
	$('#customer_person').val(data.customer_person);
	$('#company_name').val(data.company_name);
	$('#company_email').val(data.company_email);
	$('#company_address').val(data.company_address);
	$('#company_town').val(data.company_town);
	$('#company_vat').val(data.company_vat);
	$('#company_phone').val(data.company_phone);
	$('#invoice_id').val(data._id);
	$('#customer').val(data.customer);
	$('#date').val(moment(data.invoice_date).format('YYYY-MM-DD'));
	$('#due_date').val(moment(data.invoice_due_date).format('YYYY-MM-DD'));
  }



  function invoiceRows(list, i, index) {

		let data = {};

		if(list == 1) {
			data = invoices[i];
		}
		else {
			data = quotes[i];
		}
			const item = `<tr>
			<td>
				<div class="form-group form-group-sm  no-margin-bottom">
					<a href="#" class="btn btn-danger btn-xs delete-row"><span class="glyphicon glyphicon-remove" aria-hidden="true"></span></a>
					<input type="text" class="form-control form-group-sm item-input invoice_product" value="${index >= 0 ? data.invoice_product[index] : data.invoice_product}" name="invoice_product[]" placeholder="Enter item title and / or description">
					<p class="item-select">or <a href="#" class="btn btn-info btn-xs add-row"><span class="glyphicon glyphicon-search" aria-hidden="true"></span></a></p>
				</div>
			</td>
			<td>
			<div class="form-group form-group-sm  no-margin-bottom">
			   <input type="text" class="form-control form-group-sm invoice_product_desc" name="invoice_product_desc[]" value="${index >= 0 ? data.invoice_product_desc[index] : data.invoice_product_desc}">
			</div>
		</td>
			<td class="text-right">
				<div class="form-group form-group-sm no-margin-bottom">
					<input type="text" class="form-control calculate" name="invoice_product_qty[]" value="${index >= 0 ? data.invoice_product_qty[index] : data.invoice_product_qty}">
				</div>
			</td>
			<td class="text-right">
				<div class="input-group input-group-sm  no-margin-bottom">
					<span class="input-group-addon">${symbol}</span>
					<input type="text" class="form-control calculate invoice_product_price required" value="${index >= 0 ? data.invoice_product_price[index] : data.invoice_product_price}" name="invoice_product_price[]" aria-describedby="sizing-addon1" placeholder="0.00">
				</div>
			</td>
			<td class="text-right">
				<div class="form-group form-group-sm  no-margin-bottom">
					<input type="text" class="form-control calculate" name="invoice_product_discount[]" value="${index >= 0 ? data.invoice_product_discount[index] : data.invoice_product_discount}" placeholder="Enter % or value (ex: 10% or 10.50)">
				</div>
			</td>
			<td class="text-right">
				<div class="input-group input-group-sm">
					<span class="input-group-addon">${symbol}</span>
					<input type="text" class="form-control calculate-sub" name="invoice_product_sub[]" id="invoice_product_sub" value="${index >= 0 ? data.invoice_product_sub[index] : data.invoice_product_sub}" aria-describedby="sizing-addon1" readonly>
				</div>
			</td>
		</tr>`;

	return item;
  }



	function actionCreateInvoice(data){

		let id = data.action == "create_invoice" ? 2 : 3;

		if(settings == undefined) {
			let settings = {
				name: data.company_name,
				address: data.company_address,
				town: data.company_town,
				vat: data.company_vat,
				phone: data.company_phone,
				email: data.company_email,
				logo: ''
			}
			storage.set('settings', settings);
		}
		else {
			storage.set('settings.name', data.company_name);
			storage.set('settings.address', data.company_address);
			storage.set('settings.town', data.company_town);
			storage.set('settings.vat', data.company_vat);
			storage.set('settings.phone', data.company_phone);
			storage.set('settings.email', data.company_email);
		}

		settings = storage.get('settings');

			if(data.customer == "") {

				let customer = {};
				customer._id = Math.floor(Date.now() / 1000);
				customer.customer_name = data.customer_name;
				customer.customer_email = data.customer_email;
				customer.customer_address_1 = data.customer_address_1;
				customer.customer_address_2 = data.customer_address_2;
				customer.customer_postcode = data.customer_postcode;
				customer.customer_vat = data.customer_vat;
				customer.customer_phone = data.customer_phone;
				customer.customer_person = data.customer_person;				
				
				customerDB.insert( customer, function ( err, cust ) {	
					getCustomers();			
				});
			}

			if(data.invoice_status == 'accepted') {
				data.invoice_status = 'pending';
				data.action = 'create_invoice';
			}


			if(data.invoice_id == "") { 

				let new_id = 1000; 

				invoiceDB.find({}).sort({ _id: -1 }).limit(1).exec(function (err, docs) {

					if(docs.length > 0) {
						new_id = docs[0]._id + 1;
					}
						data._id = new_id;				
							invoiceDB.insert( data, function ( err, invoice ) {
								getInvoices();
								createFile(invoice);
								goToInvoices(id);
							});		

					});
				}
			else { 
				invoiceDB.update( {
					_id: parseInt(data.invoice_id)
				}, data, {}, function (
					err,
					numReplaced,
					invoice
				) {
					if ( err ) console.log(err);
					else if(numReplaced > 0) {
						getInvoices();	
						data._id = data.invoice_id;				
						createFile(data);
						goToInvoices(id);
					}
				} );
			}
 
	}


	
	function actionAddProduct(data) {

		if(data.product_id == "") { 
			data._id = Math.floor(Date.now() / 1000);				
			productDB.insert( data, function ( err, product ) {
				$('#create_product').modal('hide');
				getProducts();
				let margin = 4 * -100 + '%';
				$('.wrapper').animate({
				marginLeft: margin
				}, 0);
			});
		}
		else { 
			productDB.update( {
				_id: parseInt(data.product_id)
			}, data, {}, function (
				err,
				numReplaced,
				product
			) {
				if ( err ) console.log(err);
				else if(numReplaced > 0) {
					$('#create_product').modal('hide');
					getProducts();
				}
			} );
	
		}
	}



function actionCreateCustomer(data){
	if(data.customer_id == "") { 
		data._id = Math.floor(Date.now() / 1000);				
		customerDB.insert( data, function ( err, customer ) {
			$('#create_customer').modal('hide');
			getCustomers();

			let margin = 5 * -100 + '%';
			$('.wrapper').animate({
			marginLeft: margin
			}, 0);
		});
	}
	else { 
		customerDB.update( {
			_id: parseInt(data.customer_id)
		}, data, {}, function (
			err,
			numReplaced,
			customer
		) {
			if ( err ) console.log(err);
			else if(numReplaced > 0) {
				$('#create_customer').modal('hide');
				getCustomers();
			}
		} );

	}

}


	function goToInvoices(id) {
		let margin = id * -100 + '%';
		$('.wrapper').animate({
		marginLeft: margin
		}, 0);
	}




	function pdfRows(data, index) {
				 
		const item = `<tr>
		<td class="no">${index < 0 ? 1 : index + 1}</td>
		<td class="text-left">${index >= 0 ? data.invoice_product[index] : data.invoice_product}</td>
		<td class="text-left"><h3>${index >= 0 ? data.invoice_product_desc[index] : data.invoice_product_desc}</h3></td>
		<td class="unit">${index >= 0 ? symbol + format(data.invoice_product_price[index]) : symbol + format(data.invoice_product_price)}</td>
		<td class="qty">${index >= 0 ? data.invoice_product_qty[index] : data.invoice_product_qty}</td>
		<td class="total">${index >= 0 ? symbol + format(data.invoice_product_sub[index]) : symbol + format(data.invoice_product_sub)}</td>
		</tr>`;

	return item;
  }

  

	function createFile(invoice) {

		let rows = '';
		
		if(Array.isArray(invoice.invoice_product)) {
			invoice.invoice_product.forEach(function(item, index){
				rows += pdfRows(invoice, index);
			});
		}
		else {	
			if(invoice.invoice_product) {
				rows += pdfRows(invoice, -1);
			}			
		}
		

		const pdf_invoice  = `<header>
			<div class="row">
				<div class="col-md-6">
					<a hre="#" id="logo">
						<img src="${ settings.logo != ''? stores + file_path + settings.logo : ''}" data-holder-rendered="true" />
						</a>
				</div>
				<div class="col-md-6 company-details pull-right">
					<h2 class="name">
						<a href="#">
						${invoice.company_name}
						</a>
					</h2>
					${invoice.company_address != '' ? '<div>' + invoice.company_address + ', ' +invoice.company_town+ '</div>': ''}
					${invoice.company_email != '' ? '<div><b>Email:</b> ' + invoice.company_email + '</div>': ''}
					${invoice.company_phone != '' ? '<div><b>Phone:</b> ' + invoice.company_phone + '</div>': ''}
					${invoice.company_vat != '' ? '<div><b>Vat No:</b> ' + invoice.company_vat + '</div>': ''}
				</div>
			</div>
		</header>
		<main>
			<div class="row contacts">
				<div class="col-md-6 invoice-to">
					<div class="text-gray-light">${invoice.action == 'create_invoice' ? 'INVOICE TO:' : 'QUOTE TO:'}</div>
					<h2 class="to">${invoice.customer_name}</h2>
					${invoice.customer_address_1 != '' ? '<div class="address">' + invoice.customer_address_1 + ', ' +invoice.customer_address_2 + '</div>': ''}
					${invoice.customer_email != '' ? '<div class="email"><b>Email:</b> ' + invoice.customer_email + '</div>': ''}
					${invoice.customer_phone != '' ? '<div class="email"><b>Phone:</b> ' + invoice.customer_phone + '</div>': ''}
					${invoice.customer_vat != '' ? '<div class="email"><b>Vat No:</b> ' + invoice.customer_vat + '</div>': ''}
					</div>
				<div class="col-md-6 invoice-details pull-right">
					<h1 class="invoice-id">${invoice.action == 'create_invoice' ? 'INVOICE:' : 'QUOTE:'} ${invoice._id}</h1>
					<div class="date">Date: ${invoice.invoice_date}</div>
					<div class="date">${invoice.action == 'create_invoice' ? 'Due Date:' : 'Valid Until:'} ${invoice.invoice_due_date}</div>
				</div>
			</div>
			<table border="0" cellspacing="0" cellpadding="0">
				<thead>
					<tr>
						<th>NO.</th>
						<th class="text-left">ITEM</th>
						<th class="text-left">DESCRIPTION</th>
						<th class="text-right">PRICE</th>
						<th class="text-right">QTY</th>
						<th class="text-right">TOTAL</th>
					</tr>
				</thead>
				<tbody>			 
					${rows}				
				</tbody>
				<tfoot>
					<tr>
						<td colspan="3"></td>
						<td colspan="2">SUBTOTAL</td>
						<td>${symbol + format(invoice.invoice_subtotal)}</td>
					</tr>
					
					${invoice.invoice_discount != "0.00" ? '<tr><td colspan="3"></td><td colspan="2">DISCOUNT</td><td>'+ symbol + format(invoice.invoice_discount) + '</td></tr>' : ''}	
					${charge_vat ? '<tr><td colspan="3"></td><td colspan="2">VAT '+percentage+'%</td><td>'+ symbol + format(invoice.invoice_vat) + '</td></tr>' : ''}		
					${invoice.invoice_shipping != "" ? '<tr><td colspan="3"></td><td colspan="2">DELIVERY </td><td>'+ symbol + format(invoice.invoice_shipping) + '</td></tr>' : ''}	
													
					<tr>
						<td colspan="3"></td>
						<td colspan="2">TOTAL</td>
						<td>${symbol + format(invoice.invoice_total)}</td>
					</tr>
				</tfoot>
			</table>
 

			<div class="notices">
			${invoice.invoice_notes != "" ? '<div>PLEASE NOTE:</div><div class="notice">'+invoice.invoice_notes+'</div>' : ''}
			</div>

		</main>
		<footer>
		${settings.footer != undefined ? settings.footer : ''}
		</footer>`;

		$('#pdf').html(pdf_invoice);
		const file = invoice._id+".pdf";
		 const filename  = stores + file_path + file ;	 
			html2canvas($('#pdf').get(0), {scale: 2}).then(canvas => {
				let height = canvas.height / 8; 
				let width = canvas.width / 8;
				let pdf = new jsPDF('p', 'mm', 'a4');			 
				pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, width, height);          
				let data = pdf.output();
				fs.writeFileSync(filename, data, 'binary');
			});
	}



	$('#saveSettings').submit(function(e){
		e.preventDefault();
		storage.set('settings.charge_vat', $('#charge_vat').is(':checked') ? 1 : 0);
		storage.set('settings.vat_percentage', $('#vat_percentage').val());
		storage.set('settings.symbol', $('#symbol').val());
		storage.set('settings.footer', $('#invoice_footer').val());

		storage.set('smtp', {
			host: $('#smtp_host').val(),
			port: $('#smtp_port').val(),
			user: $('#smtp_user').val(),
			pass: $('#smtp_pass').val(),
			default: $('#smtp').is(':checked') ? 0 : 1
		});

		$('#settings').modal('hide');
		showCompanyDetails();
	});


	$('body').on('click', '#download a', (event) => {
		event.preventDefault();
		let link = event.target.href;
		require("electron").shell.openExternal(link);
	  });


	$('#smtp').change(function(){
		if ($(this).is(':checked')) {
				$('#smtp_settings').hide(500);
			} else {
				$('#smtp_settings').show(500);
		}
	});

	

	
	   



	function setDefaultSMTP() {
		host = 'mail.offlineinvoicing.com';
		user = 'send@offlineinvoicing.com';
		pass = 'AaZ0!pXELYZy';
		port = 587;
	}



  $.fn.selectCustomer = function (i) {
		$('#customer').val(customers[i]._id);
		$('#customer_name').val(customers[i].customer_name);
		$('#customer_email').val(customers[i].customer_email);
		$('#customer_address_1').val(customers[i].customer_address_1);
		$('#customer_address_2').val(customers[i].customer_address_2);
		$('#customer_postcode').val(customers[i].customer_postcode);
		$('#customer_vat').val(customers[i].customer_vat);
		$('#customer_phone').val(customers[i].customer_phone);
		$('#customer_person').val(customers[i].customer_person);
		$('#insert_customer').modal('hide');
 }



 $.fn.selectProduct = function (i) {

	let itemText = products[i].product_name;
	let itemDesc = products[i].product_desc;
	let itemValue = products[i].product_price;

	$(item).closest('tr').find('.invoice_product').val(itemText);
	$(item).closest('tr').find('.invoice_product_desc').val(itemDesc);
	$(item).closest('tr').find('.invoice_product_price').val(itemValue);

	updateTotals(item);
	calculateTotal();

	$('#insert').modal('hide');
}



	$("#action_create_invoice").click(function(e) {
		e.preventDefault(); 
		if($('#customer_name').val() == '') {
			Swal.fire(
				'No Customer Selected!',
				'Type select or type a customer name',
				'error'
			  );
			return false;
		}

		if($('#company_name').val() == '') {
			Swal.fire(
				'No From Name!',
				'Please enter your name or company name!',
				'error'
			  );
			return false;
		}


		if($('#item').val() == '' || $('#price').val() == '') {
			Swal.fire(
				'No item!',
				'Please select or enter an item and price.',
				'error'
			  );
			return false;
		}
		       
		let formData =  $("#create_invoice").toJson(); 		
	    actionCreateInvoice(formData);
	});
 

 
	$('#invoice_date, #invoice_due_date').datetimepicker({
		showClose: false,
		format: 'YYYY-MM-DD'
	});
 
    
  
    $('#invoice_table').on('click', ".delete-row", function(e) {
    	e.preventDefault();
       	$(this).closest('tr').remove();
        calculateTotal();
    });
 

	let cloned = $('#invoice_table tr:last').clone();
	
    $(".add-row").click(function(e) {
        e.preventDefault();
        cloned.clone().appendTo('#invoice_table'); 
    });
    
    calculateTotal();
    
    $('#invoice_table').on('input', '.calculate', function () {
	    updateTotals(this);
	    calculateTotal();
	});

	$('#invoice_totals').on('input', '.calculate', function () {
	    calculateTotal();
	});

	$('#invoice_product').on('input', '.calculate', function () {
	    calculateTotal();
	});
	



	function updateTotals(elem) {

        let tr = $(elem).closest('tr'),
            quantity = $('[name="invoice_product_qty[]"]', tr).val(),
	        price = $('[name="invoice_product_price[]"]', tr).val(),
            isPercent = $('[name="invoice_product_discount[]"]', tr).val().indexOf('%') > -1,
            percent = $.trim($('[name="invoice_product_discount[]"]', tr).val().replace('%', '')),
			subtotal = parseInt(quantity) * parseFloat(price);					

        if(percent && $.isNumeric(percent) && percent !== 0) {
            if(isPercent){
                subtotal = subtotal - ((parseFloat(percent) / 100) * subtotal);
            } else {
                subtotal = subtotal - parseFloat(percent);
            }
        } else {
            $('[name="invoice_product_discount[]"]', tr).val('');
        }

	    $('.calculate-sub', tr).val(subtotal.toFixed(2));
	}




	function calculateTotal() {
	    
	    let grandTotal = 0,
	    	disc = 0,
	    	c_ship = parseInt($('.calculate.shipping').val()) || 0;

	    $('#invoice_table tbody tr').each(function() {
            let c_sbt = $('.calculate-sub', this).val(),
                quantity = $('[name="invoice_product_qty[]"]', this).val(),
	            price = $('[name="invoice_product_price[]"]', this).val() || 0,
				subtotal = parseInt(quantity) * parseFloat(price);
            
            grandTotal += parseFloat(c_sbt);
            disc += subtotal - parseFloat(c_sbt);
	    });

       
	    let subT = parseFloat(grandTotal),
	    	finalTotal = parseFloat(grandTotal + c_ship),
	    	vat = percentage;

	    $('.invoice-sub-total').text(subT.toFixed(2));
	    $('#invoice_subtotal').val(subT.toFixed(2));
        $('.invoice-discount').text(disc.toFixed(2));
        $('#invoice_discount').val(disc.toFixed(2));

        if(charge_vat) {
			$('.invoice-vat').text(((vat / 100) * subT).toFixed(2));
			$('#invoice_vat').val(((vat / 100) * subT).toFixed(2));
			$('.invoice-total').text((finalTotal + ((vat / 100) * finalTotal)).toFixed(2));
			$('#invoice_total').val((finalTotal + ((vat / 100) * finalTotal)).toFixed(2));
	 
		} else {
			$('.invoice-total').text((finalTotal).toFixed(2));
			$('#invoice_total').val((finalTotal).toFixed(2));
		}

	}


	$.fn.deleteInvoice =  function(id) {

		Swal.fire({
			title: 'You are about to delete!',
			text: "Do you want to delete this invoice?",
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#d33',
			cancelButtonColor: '#3085d6',
			confirmButtonText: 'Delete'
		  }).then((result) => {     
	
			if (result.value) {
				invoiceDB.remove( {
					_id: parseInt(id)
				}, function ( err, numRemoved ) {
					getInvoices();
				});
		   }
	   });

	}


	$.fn.deleteQuote =  function(id) {

		Swal.fire({
			title: 'You are about to delete!',
			text: "Do you want to delete this quote?",
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#d33',
			cancelButtonColor: '#3085d6',
			confirmButtonText: 'Delete'
		  }).then((result) => {     
	
			if (result.value) {
				invoiceDB.remove( {
					_id: parseInt(id)
				}, function ( err, numRemoved ) {
					getInvoices();
				});
		   }
	   });
	
	}


	$.fn.deleteProduct =  function(id) {
		Swal.fire({
			title: 'You are about to delete!',
			text: "Do you want to delete this item?",
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#d33',
			cancelButtonColor: '#3085d6',
			confirmButtonText: 'Delete'
		  }).then((result) => {     
	
			if (result.value) {
				productDB.remove( {
					_id: parseInt(id)
				}, function ( err, numRemoved ) {
					getProducts();
				});
		   }
	   });

		
	}



	$.fn.deleteCustomer =  function(id) {
		Swal.fire({
			title: 'You are about to delete!',
			text: "Do you want to delete this customer?",
			icon: 'warning',
			showCancelButton: true,
			confirmButtonColor: '#d33',
			cancelButtonColor: '#3085d6',
			confirmButtonText: 'Delete'
		  }).then((result) => {     
	
			if (result.value) {
				customerDB.remove( {
					_id: parseInt(id)
				}, function ( err, numRemoved ) {
					getCustomers();
				});
		   }
	   });
		
	}


	$('#sendEmail').submit(function(e){
		e.preventDefault();
		$('#send').modal('hide');
		$('#sending').show();
		sending = true;

		let transport = nodemailer.createTransport({
			host: host,
			port: port,
			secure: false,
			auth: {
			   user: user,
			   pass: pass
			},
			tls: {
				rejectUnauthorized: false
			}
		});	 

		const message = {
			from: $('#email_from').val(),
			to: $('#email_to').val(),    
			subject: $('#email_subject').val(),  
			html: $('#email_msg').val(),
			attachments: [
				{  
				  filename: invoice._id+'.pdf',
				  path: stores + file_path + invoice._id+'.pdf'
			  }
			]
		};
		
		transport.sendMail(message, function(err, info) {
			if (err) {
				$('#sending').hide();
				sending = false;
				Swal.fire(
                    'Could not send!',
                    'Please check your SMTP login details. ' + err,
                    'error'
                  );
			} 
			else {
			  if(info.response) {
				$('#sending').hide();
				sending = false;
				Swal.fire(
                    'Sent!',
                    'Your message has been sent!',
                    'success'
                  );
			  }
			}
		});		
	});
});



(async () => {
	let updates = await checkServer('http://update.offlineinvoicing.com', 80);
	$.get('http://update.offlineinvoicing.com?version='+version, function (data) {
		data = JSON.parse(data);
		version = data.version;
	  if(data.status == 'Update') {
		  $('#download').show();
		  $('#state').text('UPDATE AVAILABLE');
		  $('#features').html('New Features: <hr>');
		  data.features.forEach(feature => {
			$('#feature_list').append(`<li>${feature}</li>`);
		  });		  
	  }
  });	 
})();




$('#dl').click(function(){
	$('#starting').show();
	$('#update').hide();
	$('#dl').hide();

	require("electron").remote.require("electron-download-manager").download({
		url: "http://update.offlineinvoicing.com/OfflineInvoicing-" + version + ".msi"
	}, function (error, info) {
		if (error) {
			console.log(error);
			return;
		}
		$('#starting').hide();
		$('#confirmation').text('Download Complete');
		$('#install').show();	 
	 
	});
});

 


$('#install').click(function(){	
	if(shell.openItem(app.getPath("downloads") + "\\OfflineInvoicing\\OfflineInvoicing-" + version + ".msi")) {
		ipcRenderer.send('app-quit', '');
	}	 
});






