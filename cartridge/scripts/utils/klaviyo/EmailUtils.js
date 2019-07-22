'use strict';

var Site = require('dw/system/Site');
var Logger = require('dw/system/Logger');
var Resource = require('dw/web/Resource');
var URLUtils = require('dw/web/URLUtils');
var app = require('app_controllers/cartridge/scripts/app');

/**
 * Sends an order to Klaviyo with the order email type.
 *
 * @param order
 * @param mailType
 * @returns
 */
function sendOrderEmail(order, mailType) {
	var logger = Logger.getLogger('Klaviyo', 'EmailUtils - sendOrderEmail()');
	try {
		var isFutureOrder = (mailType == 'Auto Delivery Order Confirmation') ? true : false;
		var orderPayload = prepareOrderPayload(order, isFutureOrder, mailType);
		require('int_klaviyo/cartridge/scripts/utils/klaviyo/KlaviyoUtils').sendEmail(order.getCustomerEmail(), orderPayload, mailType);
	} catch (e) {
		logger.error('sendOrderEmail() failed for order: ' + order.getOrderNo() + ', mailType: ' +  mailType + '. Error: ' +  e.message);
		return;
	}
}



/**
 * Prepares the order in JSON format for email send.
 * @param order
 * @param isFutureOrder
 * @param mailType
 * @returns
 */
function prepareOrderPayload(order, isFutureOrder, mailType) {

	var orderDetails = {};
	var isReplenishmentOrder = (mailType != null && mailType == 'Auto Delivery Order Confirmation') ? true : false;

	// Billing Address
	var orderBillingAddressfirstName = (order.billingAddress.firstName)?order.billingAddress.firstName:'';
	var orderBillingAddressLastName = (order.billingAddress.lastName)?order.billingAddress.lastName:'';
	var orderBillingAddressAddress1 = (order.billingAddress.address1)?order.billingAddress.address1:'';
	var orderBillingAddressAddress2 = (order.billingAddress.address2)?order.billingAddress.address2:'';
	var orderBillingAddressCity = (order.billingAddress.city)?order.billingAddress.city:'';
	var orderBillingAddressPostalCode = (order.billingAddress.postalCode)?order.billingAddress.postalCode:'';
	var orderBillingAddressStateCode = (order.billingAddress.stateCode)?order.billingAddress.stateCode:'';
	var orderBillingAddressCountryCode = (order.billingAddress.countryCode.value)?order.billingAddress.countryCode.value:'';
	var orderBillingAddressPhone = (order.billingAddress.phone)?order.billingAddress.phone:'';

	// Shipping address
	var orderShippingAddressFirstName = '';
	var orderShippingAddressLastName = '';
	var orderShippingAddressAddress1 = '';
	var orderShippingAddressAddress2 = '';
	var orderShippingAddressCity = '';
	var orderShippingAddressPostalCode = '';
	var orderShippingAddressStateCode = '';
	var orderShippingAddressCountryCode = '';
	var orderShippingAddressPhone = '';
	var productLineItems = '';
	var paymentInstruments = '';

	if(order.shipments.length > 0){

		// Shipping Address
		orderShippingAddressFirstName = (order.shipments[0].shippingAddress.firstName)?order.shipments[0].shippingAddress.firstName:'';
		orderShippingAddressLastName = (order.shipments[0].shippingAddress.lastName)?order.shipments[0].shippingAddress.lastName:'';
		orderShippingAddressAddress1 = (order.shipments[0].shippingAddress.address1)?order.shipments[0].shippingAddress.address1:'';
		orderShippingAddressAddress2 = (order.shipments[0].shippingAddress.address2)?order.shipments[0].shippingAddress.address2:'';
		orderShippingAddressCity = (order.shipments[0].shippingAddress.city)?order.shipments[0].shippingAddress.city:'';
		orderShippingAddressPostalCode = (order.shipments[0].shippingAddress.postalCode)?order.shipments[0].shippingAddress.postalCode:'';
		orderShippingAddressStateCode = (order.shipments[0].shippingAddress.stateCode)?order.shipments[0].shippingAddress.stateCode:'';
		orderShippingAddressCountryCode = (order.shipments[0].shippingAddress.countryCode.value)?order.shipments[0].shippingAddress.countryCode.value:'';
		orderShippingAddressPhone = (order.shipments[0].shippingAddress.phone)?order.shipments[0].shippingAddress.phone:'';

		var lineItems = order.getAllProductLineItems();
		var iterator_lines = lineItems.iterator();

		// Product Details
		productLineItems = order.shipments[0].productLineItems;
		var productLineItem = {};
		var productLineItemsArray = [];
		var items = [];
		var itemCount = 0;
		var itemPrimaryCategories = [];
		var itemCategories = [];

		for(var j in productLineItems) {
			productLineItem = productLineItems[j];
		    var prdUrl = '';
		    var replenishment = false;
		    var priceString = '';
		    var priceValue = 0.0;
		    var hasOsfSmartOrderRefill = false;


		    prdUrl = require('dw/web/URLUtils').http('Product-Show', 'pid', productLineItem.productID).toString();
		    var secondaryName = '';
		    // Get the product secondary name
		    var productDetail = app.getModel('Product').get(productLineItem.productID).object;

		    if(!productLineItem.bonusProductLineItem) {
		    	priceString = dw.util.StringUtils.formatMoney(dw.value.Money(productLineItem.price.value, session.getCurrency().getCurrencyCode()));
		    } else {
		    	priceString = dw.util.StringUtils.formatMoney(dw.value.Money(0, session.getCurrency().getCurrencyCode()));
		    }

		    //Variation values
		    var variationValues = '';
		    if(productDetail.isVariant()) {
		    	var variationAttrs = productDetail.variationModel.getProductVariationAttributes();
		    	for(var i = 0; i < variationAttrs.length; i++) {
		    		var VA = variationAttrs[i];
		    		var selectedValue = productDetail.variationModel.getSelectedValue(VA);
		    		if(selectedValue) {
		    			variationValues = variationValues + selectedValue.displayValue;
			    		if(i < (variationAttrs.length - 1)) {
			    			variationValues = variationValues + ' | ';
			    		}
		    		}
		    	}
		    }

			items.push(productLineItem.productID);

			itemCount = itemCount + productLineItem.quantity.value;

			if(productDetail.variant) {
				itemPrimaryCategories.push(productDetail.masterProduct.getPrimaryCategory().displayName);
				var allCategories = productDetail.masterProduct.getAllCategories();
	    	}else{
	    		itemPrimaryCategories.push(productDetail.getPrimaryCategory().displayName);
	    		var allCategories = productDetail.getAllCategories();
	    	}


			var isSample = false;
			if(!empty(allCategories) && allCategories.length > 0) {
				var category = '';
				for(var categoryCount = 0; categoryCount < allCategories.length; categoryCount++) {
					category = allCategories[categoryCount];
					itemCategories.push(category.displayName);
					if(category.ID == 'samples') {
						isSample = true;
					}
				}
			}

			productLineItemsArray.push({
					'Product ID': productLineItem.productID,
					'Product Name':productLineItem.productName,
					'Product Secondary Name': secondaryName,
					'Quantity': productLineItem.quantity.value,
					'Price': priceString,
					'Discount': productLineItem.adjustedPrice.value,
					'Product Page URL': prdUrl,
					'Replenishment': replenishment,
					'Product Variant': variationValues,
					'Price Value': productLineItem.price.value,
					'Product Image URL': productDetail.getImage("hi-res") ? productDetail.getImage("hi-res").getAbsURL().toString() : null,
					'Is Sample': isSample
		    });

		}

		//Append gift card
		var giftCertificateLineItems = order.giftCertificateLineItems;
		var giftLineItem = {};
		var giftLineItemsArray = [];
		if(giftCertificateLineItems && giftCertificateLineItems.length > 0){
			orderDetails['Gift Item Present'] =  true;
			var giftCardId = Site.getCurrent().getCustomPreferenceValue('EgiftProduct-ID')
			var giftCardProductDetail = app.getModel('Product').get(giftCardId).object;
			var giftCardImage = '';
			if(!empty(giftCardProductDetail)) {
				giftCardImage = giftCardProductDetail.getImage("large").getAbsURL().toString();
			}
			for(var j in giftCertificateLineItems) {
				giftLineItem = giftCertificateLineItems[j];

				giftLineItemsArray.push({
						'Recipient Name': giftLineItem.recipientName,
						'Recipient Email':giftLineItem.recipientEmail,
						'Sender Name': giftLineItem.senderName,
						'Sender Email': order.getCustomerEmail(),
						'Price': dw.util.StringUtils.formatMoney(dw.value.Money(giftLineItem.price.value, session.getCurrency().getCurrencyCode())),
						'Message': giftLineItem.message,
		        'Image': !empty(giftLineItem.custom.giftCertificateImage) ? giftLineItem.custom.giftCertificateImage : giftCardImage
			    });

				items.push(Site.getCurrent().getCustomPreferenceValue('EgiftProduct-ID'));
				itemCount = itemCount + 1;
				itemPrimaryCategories.push('Gift cards');
				itemCategories.push('Gift cards');
			}
		} else {
			orderDetails['Gift Item Present'] =  false;
			giftLineItemsArray.push({
					'Recipient Name': '',
 	        'Recipient Email':'',
 	        'Sender Name': '',
 	        'Sender Email': '',
 	        'Price': ''
		    });
		}


		// Get the coupon attached to the order
		var discountCoupon = '';
		var shippingLineItems = order.shipments[0].shippingLineItems;
		var shippingLineItem = {};
		var shippingItemsArray = [];
		if(shippingLineItems && shippingLineItems.length > 0){
			if(shippingLineItems[0].lineItemCtnr){
				var couponLineItems = shippingLineItems[0].lineItemCtnr.couponLineItems;
				if(couponLineItems && couponLineItems.length > 0){
					var couponLineItem = {};
					for(var j in couponLineItems) {
						if(couponLineItems[j].statusCode == 'APPLIED'){
							discountCoupon = couponLineItems[j].couponCode;
							break;
						}

					}
				}
			}

		} else {
			discountCoupon = '';
		}


		// Payment Details
		paymentInstruments = order.paymentInstruments;
		var ccLastFourDigits = '';
		var creditCardType = '';
		var paymentInstrumentItem = {};
		var paymentInstrumentsArray = [];
		var maskedGiftCertificateCode = '';
		for(var j in paymentInstruments) {
			paymentInstrumentItem = paymentInstruments[j];
			if(paymentInstrumentItem.creditCardNumberLastDigits) {
				ccLastFourDigits = paymentInstrumentItem.maskedCreditCardNumber;
				creditCardType = (paymentInstrumentItem.creditCardType)?paymentInstrumentItem.creditCardType:'';
			}
			if(paymentInstrumentItem.maskedGiftCertificateCode){
				maskedGiftCertificateCode = paymentInstrumentItem.maskedGiftCertificateCode;
			}
		}


		// Order Total
		var merchTotalExclOrderDiscounts = order.getAdjustedMerchandizeTotalPrice(false);
		var merchTotalInclOrderDiscounts = order.getAdjustedMerchandizeTotalPrice(true);


		// Merchandise total
		var merchandiseTotal = merchTotalExclOrderDiscounts.add(order.giftCertificateTotalPrice);
		var merchandiseTotalString = dw.util.StringUtils.formatMoney(dw.value.Money(merchandiseTotal.value, session.getCurrency().getCurrencyCode()));

		//discounts
		var orderDiscount = merchTotalExclOrderDiscounts.subtract( merchTotalInclOrderDiscounts );
		var orderDiscountString = dw.util.StringUtils.formatMoney(dw.value.Money(orderDiscount.value, session.getCurrency().getCurrencyCode()));

		// Sub Total
		var subTotal = merchTotalInclOrderDiscounts.add(order.giftCertificateTotalPrice);
		var subTotalString = dw.util.StringUtils.formatMoney(dw.value.Money(subTotal.value, session.getCurrency().getCurrencyCode()));

		//Shipping
		var shippingExclDiscounts = order.shippingTotalPrice;
		var shippingInclDiscounts = order.getAdjustedShippingTotalPrice();
		var shippingDiscount = shippingExclDiscounts.subtract( shippingInclDiscounts );
		var shippingTotalCost = shippingExclDiscounts.subtract( shippingDiscount );
		var shippingTotalCostString = dw.util.StringUtils.formatMoney(dw.value.Money(shippingTotalCost.value, session.getCurrency().getCurrencyCode()));

		// Tax
		var totalTax = 0.00;
		if(order.totalTax.available){
			totalTax = order.totalTax.value;
		} else if(order.giftCertificateTotalPrice.available){
			totalTax = order.merchandizeTotalTax.value;
		}
		var totalTaxString = dw.util.StringUtils.formatMoney(dw.value.Money(totalTax, session.getCurrency().getCurrencyCode()));


		// Order Total
		var orderTotal = '';
		if(order.totalNetPrice.available){
			orderTotal = order.totalNetPrice.value + totalTax;
		} else {
			orderTotal = order.getAdjustedMerchandizeTotalPrice(true)+(order.giftCertificateTotalPrice)+(shippingTotalPrice)+(totalTax);
		}
		var orderTotalString = dw.util.StringUtils.formatMoney(dw.value.Money(orderTotal, session.getCurrency().getCurrencyCode()));

		orderDetails['Order Total'] =  orderTotalString;
		orderDetails['Tax'] = totalTaxString;
		orderDetails['Subtotal'] = subTotalString;
		orderDetails['Shipping Cost'] = shippingTotalCostString;
		if (orderDiscountString){
			orderDetails['Discount'] = orderDiscountString;
		} else {
			orderDetails['Discount'] = '';
		}

	}

	// Order Details
	var orderDate = new Date(order.creationDate);
	var orderCreationDate = dw.util.StringUtils.formatCalendar(new dw.util.Calendar(orderDate), 'yyyy-MM-dd' );
	orderDetails['Order Number'] = order.orderNo;
	orderDetails['Order Date'] = orderCreationDate;
	orderDetails['Customer Number'] = (order.customerNo)?order.customerNo:'';
	orderDetails['Customer Name'] = order.customerName;
	orderDetails['Shipping Method'] = (order.shipments[0].shippingMethod && order.shipments[0].shippingMethod.displayName)?order.shipments[0].shippingMethod.displayName:'';
	orderDetails['Card Last Four Digits'] = ccLastFourDigits;
	orderDetails['Card Type'] = creditCardType;
	orderDetails['Gift Card Last Four'] = maskedGiftCertificateCode;
	orderDetails['Promo Code'] = discountCoupon;
	// orderDetails['Promo ID'] = promotionID;
	var promoType = '';
	var position = discountCoupon.search('GIFT');
    if(position == 0) {
    	promoType = 'Gift';
    }
    position = discountCoupon.search('CODE');
    if(position == 0) {
    	promoType = 'Code';
    }
	orderDetails['Replenishment Order'] = isReplenishmentOrder;

	// Billing Address
	var billingaddress = [];
	billingaddress.push({
			'First Name': orderBillingAddressfirstName,
			'Last Name':orderBillingAddressLastName,
			'Address1': orderBillingAddressAddress1,
			'Address2': orderBillingAddressAddress2,
			'City': orderBillingAddressCity,
			'Postal Code': orderShippingAddressPostalCode,
			'State Code': orderBillingAddressStateCode,
			'Country Code': orderBillingAddressCountryCode,
			'Phone': orderBillingAddressPhone
    });

	// Shipping Address
	var shippingaddress = [];
	shippingaddress.push({
			'First Name': orderShippingAddressFirstName,
			'Last Name':orderShippingAddressLastName,
			'Address1': orderShippingAddressAddress1,
			'Address2': orderShippingAddressAddress2,
			'City': orderShippingAddressCity,
			'Postal Code': orderShippingAddressPostalCode,
			'State Code': orderShippingAddressStateCode,
			'Country Code': orderShippingAddressCountryCode,
			'Phone': orderShippingAddressPhone
    });

	// Add product / billing / shipping

  var accountDetails = require('dw/web/URLUtils').https('Account-Show').toString();
	orderDetails['product_line_items'] = productLineItemsArray;
	orderDetails['Gift Items'] = giftLineItemsArray;
	orderDetails['Billing Address'] = billingaddress;
	orderDetails['Shipping Address'] = shippingaddress;
	orderDetails['Manage Order URL'] = accountDetails;
	orderDetails['Items'] = items;
	orderDetails['Item Count'] = itemCount;
	orderDetails['Item Primary Categories'] = itemPrimaryCategories;
	orderDetails['Item Categories'] = require('*/cartridge/scripts/utils/klaviyo/KlaviyoUtils').removeDuplicates(itemCategories);
	orderDetails["$value"] = orderTotal;
	orderDetails["$event_id"] = mailType + '-' + order.orderNo;

	orderDetails['Tracking Number'] = (order.shipments[0].trackingNumber)?order.shipments[0].trackingNumber:'';
	var shipment = order.shipments[0];

	return orderDetails;

}

/** Testable functions **/

module.exports = {
	sendOrderEmail: sendOrderEmail,
	prepareOrderPayload: prepareOrderPayload
};
