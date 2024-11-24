import { object, string, optional, array, lazy, nullable, boolean, number, dict, unknown, bigint } from '@apimatic/schema';
import { accessTokenAuthenticationProvider, compositeAuthenticationProvider } from '@apimatic/authentication-adapters';
import JSONBig from '@apimatic/json-bigint';
import { updateUserAgent, AbortError, pathTemplate, SkipEncode, createRequestBuilderFactory, assertHeaders, mergeHeaders, setHeader } from '@apimatic/core';
import { HttpClient } from '@apimatic/axios-client-adapter';

const registerDomainRequestSchema = object({ domainName: ['domain_name', string()] });

const errorSchema = object({
    category: ['category', string()],
    code: ['code', string()],
    detail: ['detail', optional(string())],
    field: ['field', optional(string())],
});

const registerDomainResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    status: ['status', optional(string())],
});

/** Base class for all controllers */
class BaseApi {
    constructor(client) {
        this.createRequest = client.getRequestBuilderFactory();
    }
}

class ApplePayApi extends BaseApi {
    /**
     * Activates a domain for use with Apple Pay on the Web and Square. A validation
     * is performed on this domain by Apple to ensure that it is properly set up as
     * an Apple Pay enabled domain.
     *
     * This endpoint provides an easy way for platform developers to bulk activate
     * Apple Pay on the Web with Square for merchants using their platform.
     *
     * Note: You will need to host a valid domain verification file on your domain to support Apple Pay.
     * The
     * current version of this file is always available at https://app.squareup.com/digital-wallets/apple-
     * pay/apple-developer-merchantid-domain-association,
     * and should be hosted at `.well_known/apple-developer-merchantid-domain-association` on your
     * domain.  This file is subject to change; we strongly recommend checking for updates regularly and
     * avoiding
     * long-lived caches that might not keep in sync with the correct file version.
     *
     * To learn more about the Web Payments SDK and how to add Apple Pay, see [Take an Apple Pay
     * Payment](https://developer.squareup.com/docs/web-payments/apple-pay).
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                     the corresponding object definition for field details.
     * @return Response from the API call
     */
    async registerDomain(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/apple-pay/domains');
        const mapped = req.prepareArgs({
            body: [body, registerDomainRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(registerDomainResponseSchema, requestOptions);
    }
}

const bankAccountSchema = object({
    id: ['id', string()],
    accountNumberSuffix: ['account_number_suffix', string()],
    country: ['country', string()],
    currency: ['currency', string()],
    accountType: ['account_type', string()],
    holderName: ['holder_name', string()],
    primaryBankIdentificationNumber: [
        'primary_bank_identification_number',
        string(),
    ],
    secondaryBankIdentificationNumber: [
        'secondary_bank_identification_number',
        optional(nullable(string())),
    ],
    debitMandateReferenceId: [
        'debit_mandate_reference_id',
        optional(nullable(string())),
    ],
    referenceId: ['reference_id', optional(nullable(string()))],
    locationId: ['location_id', optional(nullable(string()))],
    status: ['status', string()],
    creditable: ['creditable', boolean()],
    debitable: ['debitable', boolean()],
    fingerprint: ['fingerprint', optional(nullable(string()))],
    version: ['version', optional(number())],
    bankName: ['bank_name', optional(nullable(string()))],
});

const getBankAccountByV1IdResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    bankAccount: ['bank_account', optional(lazy(() => bankAccountSchema))],
});

const getBankAccountResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    bankAccount: ['bank_account', optional(lazy(() => bankAccountSchema))],
});

const listBankAccountsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    bankAccounts: [
        'bank_accounts',
        optional(array(lazy(() => bankAccountSchema))),
    ],
    cursor: ['cursor', optional(string())],
});

class BankAccountsApi extends BaseApi {
    /**
     * Returns a list of [BankAccount]($m/BankAccount) objects linked to a Square account.
     *
     * @param cursor      The pagination cursor returned by a previous call to this endpoint. Use it in the
     *                              next `ListBankAccounts` request to retrieve the next set  of results.  See the
     *                              [Pagination](https://developer.squareup.com/docs/working-with-apis/pagination) guide
     *                              for more information.
     * @param limit       Upper limit on the number of bank accounts to return in the response.  Currently,
     *                              1000 is the largest supported limit. You can specify a limit  of up to 1000 bank
     *                              accounts. This is also the default limit.
     * @param locationId  Location ID. You can specify this optional filter  to retrieve only the linked bank
     *                              accounts belonging to a specific location.
     * @return Response from the API call
     */
    async listBankAccounts(cursor, limit, locationId, requestOptions) {
        const req = this.createRequest('GET', '/v2/bank-accounts');
        const mapped = req.prepareArgs({
            cursor: [cursor, optional(string())],
            limit: [limit, optional(number())],
            locationId: [locationId, optional(string())],
        });
        req.query('cursor', mapped.cursor);
        req.query('limit', mapped.limit);
        req.query('location_id', mapped.locationId);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listBankAccountsResponseSchema, requestOptions);
    }
    /**
     * Returns details of a [BankAccount]($m/BankAccount) identified by V1 bank account ID.
     *
     * @param v1BankAccountId    Connect V1 ID of the desired `BankAccount`. For more information, see
     *                                     [Retrieve a bank account by using an ID issued by V1 Bank Accounts API](https:
     *                                     //developer.squareup.com/docs/bank-accounts-api#retrieve-a-bank-account-by-
     *                                     using-an-id-issued-by-v1-bank-accounts-api).
     * @return Response from the API call
     */
    async getBankAccountByV1Id(v1BankAccountId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            v1BankAccountId: [v1BankAccountId, string()],
        });
        req.appendTemplatePath `/v2/bank-accounts/by-v1-id/${mapped.v1BankAccountId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getBankAccountByV1IdResponseSchema, requestOptions);
    }
    /**
     * Returns details of a [BankAccount]($m/BankAccount)
     * linked to a Square account.
     *
     * @param bankAccountId   Square-issued ID of the desired `BankAccount`.
     * @return Response from the API call
     */
    async getBankAccount(bankAccountId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            bankAccountId: [bankAccountId, string()],
        });
        req.appendTemplatePath `/v2/bank-accounts/${mapped.bankAccountId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getBankAccountResponseSchema, requestOptions);
    }
}

const bookingCustomAttributeDeleteRequestSchema = object({ bookingId: ['booking_id', string()], key: ['key', string()] });

const bulkDeleteBookingCustomAttributesRequestSchema = object({
    values: [
        'values',
        dict(lazy(() => bookingCustomAttributeDeleteRequestSchema)),
    ],
});

const bookingCustomAttributeDeleteResponseSchema = object({
    bookingId: ['booking_id', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkDeleteBookingCustomAttributesResponseSchema = object({
    values: [
        'values',
        optional(dict(lazy(() => bookingCustomAttributeDeleteResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const customAttributeDefinitionSchema = object({
    key: ['key', optional(nullable(string()))],
    schema: ['schema', optional(nullable(dict(unknown())))],
    name: ['name', optional(nullable(string()))],
    description: ['description', optional(nullable(string()))],
    visibility: ['visibility', optional(string())],
    version: ['version', optional(number())],
    updatedAt: ['updated_at', optional(string())],
    createdAt: ['created_at', optional(string())],
});

const customAttributeSchema = object({
    key: ['key', optional(nullable(string()))],
    value: ['value', optional(nullable(unknown()))],
    version: ['version', optional(number())],
    visibility: ['visibility', optional(string())],
    definition: [
        'definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    updatedAt: ['updated_at', optional(string())],
    createdAt: ['created_at', optional(string())],
});

const bookingCustomAttributeUpsertRequestSchema = object({
    bookingId: ['booking_id', string()],
    customAttribute: ['custom_attribute', lazy(() => customAttributeSchema)],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const bulkUpsertBookingCustomAttributesRequestSchema = object({
    values: [
        'values',
        dict(lazy(() => bookingCustomAttributeUpsertRequestSchema)),
    ],
});

const bookingCustomAttributeUpsertResponseSchema = object({
    bookingId: ['booking_id', optional(string())],
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkUpsertBookingCustomAttributesResponseSchema = object({
    values: [
        'values',
        optional(dict(lazy(() => bookingCustomAttributeUpsertResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const createBookingCustomAttributeDefinitionRequestSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        lazy(() => customAttributeDefinitionSchema),
    ],
    idempotencyKey: ['idempotency_key', optional(string())],
});

const createBookingCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const deleteBookingCustomAttributeDefinitionResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const deleteBookingCustomAttributeResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const listBookingCustomAttributeDefinitionsResponseSchema = object({
    customAttributeDefinitions: [
        'custom_attribute_definitions',
        optional(array(lazy(() => customAttributeDefinitionSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const listBookingCustomAttributesResponseSchema = object({
    customAttributes: [
        'custom_attributes',
        optional(array(lazy(() => customAttributeSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveBookingCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveBookingCustomAttributeResponseSchema = object({
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateBookingCustomAttributeDefinitionRequestSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        lazy(() => customAttributeDefinitionSchema),
    ],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const updateBookingCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const upsertBookingCustomAttributeRequestSchema = object({
    customAttribute: ['custom_attribute', lazy(() => customAttributeSchema)],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const upsertBookingCustomAttributeResponseSchema = object({
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class BookingCustomAttributesApi extends BaseApi {
    /**
     * Get all bookings custom attribute definitions.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_READ` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_READ` and
     * `APPOINTMENTS_READ` for the OAuth scope.
     *
     * @param limit  The maximum number of results to return in a single paged response. This limit is
     *                         advisory. The response might contain more or fewer results. The minimum value is 1 and the
     *                         maximum value is 100. The default value is 20. For more information, see
     *                         [Pagination](https://developer.squareup.com/docs/build-basics/common-api-
     *                         patterns/pagination).
     * @param cursor The cursor returned in the paged response from the previous call to this endpoint.
     *                         Provide this cursor to retrieve the next page of results for your original request. For
     *                         more information, see [Pagination](https://developer.squareup.com/docs/build-basics/common-
     *                         api-patterns/pagination).
     * @return Response from the API call
     */
    async listBookingCustomAttributeDefinitions(limit, cursor, requestOptions) {
        const req = this.createRequest('GET', '/v2/bookings/custom-attribute-definitions');
        const mapped = req.prepareArgs({
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
        });
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listBookingCustomAttributeDefinitionsResponseSchema, requestOptions);
    }
    /**
     * Creates a bookings custom attribute definition.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_WRITE` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_WRITE` and
     * `APPOINTMENTS_WRITE` for the OAuth scope.
     *
     * For calls to this endpoint with seller-level permissions to succeed, the seller must have subscribed
     * to *Appointments Plus*
     * or *Appointments Premium*.
     *
     * @param body         An object containing the fields to
     *                                                                             POST for the request.  See the
     *                                                                             corresponding object definition for
     *                                                                             field details.
     * @return Response from the API call
     */
    async createBookingCustomAttributeDefinition(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/bookings/custom-attribute-definitions');
        const mapped = req.prepareArgs({
            body: [body, createBookingCustomAttributeDefinitionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createBookingCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Deletes a bookings custom attribute definition.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_WRITE` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_WRITE` and
     * `APPOINTMENTS_WRITE` for the OAuth scope.
     *
     * For calls to this endpoint with seller-level permissions to succeed, the seller must have subscribed
     * to *Appointments Plus*
     * or *Appointments Premium*.
     *
     * @param key The key of the custom attribute definition to delete.
     * @return Response from the API call
     */
    async deleteBookingCustomAttributeDefinition(key, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({ key: [key, string()] });
        req.appendTemplatePath `/v2/bookings/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteBookingCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Retrieves a bookings custom attribute definition.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_READ` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_READ` and
     * `APPOINTMENTS_READ` for the OAuth scope.
     *
     * @param key     The key of the custom attribute definition to retrieve. If the requesting application is
     *                          not the definition owner, you must use the qualified key.
     * @param version The current version of the custom attribute definition, which is used for strongly
     *                          consistent reads to guarantee that you receive the most up-to-date data. When included in
     *                          the request, Square returns the specified version or a higher version if one exists. If
     *                          the specified version is higher than the current version, Square returns a `BAD_REQUEST`
     *                          error.
     * @return Response from the API call
     */
    async retrieveBookingCustomAttributeDefinition(key, version, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            key: [key, string()],
            version: [version, optional(number())],
        });
        req.query('version', mapped.version);
        req.appendTemplatePath `/v2/bookings/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveBookingCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Updates a bookings custom attribute definition.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_WRITE` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_WRITE` and
     * `APPOINTMENTS_WRITE` for the OAuth scope.
     *
     * For calls to this endpoint with seller-level permissions to succeed, the seller must have subscribed
     * to *Appointments Plus*
     * or *Appointments Premium*.
     *
     * @param key          The key of the custom attribute
     *                                                                             definition to update.
     * @param body         An object containing the fields to
     *                                                                             POST for the request.  See the
     *                                                                             corresponding object definition for
     *                                                                             field details.
     * @return Response from the API call
     */
    async updateBookingCustomAttributeDefinition(key, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            key: [key, string()],
            body: [body, updateBookingCustomAttributeDefinitionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/bookings/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateBookingCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Bulk deletes bookings custom attributes.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_WRITE` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_WRITE` and
     * `APPOINTMENTS_WRITE` for the OAuth scope.
     *
     * For calls to this endpoint with seller-level permissions to succeed, the seller must have subscribed
     * to *Appointments Plus*
     * or *Appointments Premium*.
     *
     * @param body         An object containing the fields to POST
     *                                                                        for the request.  See the corresponding
     *                                                                        object definition for field details.
     * @return Response from the API call
     */
    async bulkDeleteBookingCustomAttributes(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/bookings/custom-attributes/bulk-delete');
        const mapped = req.prepareArgs({
            body: [body, bulkDeleteBookingCustomAttributesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkDeleteBookingCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Bulk upserts bookings custom attributes.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_WRITE` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_WRITE` and
     * `APPOINTMENTS_WRITE` for the OAuth scope.
     *
     * For calls to this endpoint with seller-level permissions to succeed, the seller must have subscribed
     * to *Appointments Plus*
     * or *Appointments Premium*.
     *
     * @param body         An object containing the fields to POST
     *                                                                        for the request.  See the corresponding
     *                                                                        object definition for field details.
     * @return Response from the API call
     */
    async bulkUpsertBookingCustomAttributes(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/bookings/custom-attributes/bulk-upsert');
        const mapped = req.prepareArgs({
            body: [body, bulkUpsertBookingCustomAttributesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkUpsertBookingCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Lists a booking's custom attributes.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_READ` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_READ` and
     * `APPOINTMENTS_READ` for the OAuth scope.
     *
     * @param bookingId        The ID of the target [booking](entity:Booking).
     * @param limit            The maximum number of results to return in a single paged response. This limit
     *                                    is advisory. The response might contain more or fewer results. The minimum
     *                                    value is 1 and the maximum value is 100. The default value is 20. For more
     *                                    information, see [Pagination](https://developer.squareup.com/docs/build-
     *                                    basics/common-api-patterns/pagination).
     * @param cursor           The cursor returned in the paged response from the previous call to this
     *                                    endpoint. Provide this cursor to retrieve the next page of results for your
     *                                    original request. For more information, see [Pagination](https://developer.
     *                                    squareup.com/docs/build-basics/common-api-patterns/pagination).
     * @param withDefinitions  Indicates whether to return the [custom attribute definition](entity:
     *                                    CustomAttributeDefinition) in the `definition` field of each custom attribute.
     *                                    Set this parameter to `true` to get the name and description of each custom
     *                                    attribute, information about the data type, or other definition details. The
     *                                    default value is `false`.
     * @return Response from the API call
     */
    async listBookingCustomAttributes(bookingId, limit, cursor, withDefinitions, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            bookingId: [bookingId, string()],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
            withDefinitions: [withDefinitions, optional(boolean())],
        });
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.query('with_definitions', mapped.withDefinitions);
        req.appendTemplatePath `/v2/bookings/${mapped.bookingId}/custom-attributes`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(listBookingCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Deletes a bookings custom attribute.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_WRITE` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_WRITE` and
     * `APPOINTMENTS_WRITE` for the OAuth scope.
     *
     * For calls to this endpoint with seller-level permissions to succeed, the seller must have subscribed
     * to *Appointments Plus*
     * or *Appointments Premium*.
     *
     * @param bookingId  The ID of the target [booking](entity:Booking).
     * @param key        The key of the custom attribute to delete. This key must match the `key` of a custom
     *                             attribute definition in the Square seller account. If the requesting application is
     *                             not the definition owner, you must use the qualified key.
     * @return Response from the API call
     */
    async deleteBookingCustomAttribute(bookingId, key, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            bookingId: [bookingId, string()],
            key: [key, string()],
        });
        req.appendTemplatePath `/v2/bookings/${mapped.bookingId}/custom-attributes/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteBookingCustomAttributeResponseSchema, requestOptions);
    }
    /**
     * Retrieves a bookings custom attribute.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_READ` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_READ` and
     * `APPOINTMENTS_READ` for the OAuth scope.
     *
     * @param bookingId       The ID of the target [booking](entity:Booking).
     * @param key             The key of the custom attribute to retrieve. This key must match the `key` of a
     *                                   custom attribute definition in the Square seller account. If the requesting
     *                                   application is not the definition owner, you must use the qualified key.
     * @param withDefinition  Indicates whether to return the [custom attribute definition](entity:
     *                                   CustomAttributeDefinition) in the `definition` field of the custom attribute.
     *                                   Set this parameter to `true` to get the name and description of the custom
     *                                   attribute, information about the data type, or other definition details. The
     *                                   default value is `false`.
     * @param version         The current version of the custom attribute, which is used for strongly
     *                                   consistent reads to guarantee that you receive the most up-to-date data. When
     *                                   included in the request, Square returns the specified version or a higher
     *                                   version if one exists. If the specified version is higher than the current
     *                                   version, Square returns a `BAD_REQUEST` error.
     * @return Response from the API call
     */
    async retrieveBookingCustomAttribute(bookingId, key, withDefinition, version, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            bookingId: [bookingId, string()],
            key: [key, string()],
            withDefinition: [withDefinition, optional(boolean())],
            version: [version, optional(number())],
        });
        req.query('with_definition', mapped.withDefinition);
        req.query('version', mapped.version);
        req.appendTemplatePath `/v2/bookings/${mapped.bookingId}/custom-attributes/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveBookingCustomAttributeResponseSchema, requestOptions);
    }
    /**
     * Upserts a bookings custom attribute.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_WRITE` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_WRITE` and
     * `APPOINTMENTS_WRITE` for the OAuth scope.
     *
     * For calls to this endpoint with seller-level permissions to succeed, the seller must have subscribed
     * to *Appointments Plus*
     * or *Appointments Premium*.
     *
     * @param bookingId    The ID of the target [booking](entity:Booking).
     * @param key          The key of the custom attribute to create or
     *                                                                   update. This key must match the `key` of a
     *                                                                   custom attribute definition in the Square seller
     *                                                                   account. If the requesting application is not
     *                                                                   the definition owner, you must use the qualified
     *                                                                   key.
     * @param body         An object containing the fields to POST for the
     *                                                                   request.  See the corresponding object
     *                                                                   definition for field details.
     * @return Response from the API call
     */
    async upsertBookingCustomAttribute(bookingId, key, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            bookingId: [bookingId, string()],
            key: [key, string()],
            body: [body, upsertBookingCustomAttributeRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/bookings/${mapped.bookingId}/custom-attributes/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(upsertBookingCustomAttributeResponseSchema, requestOptions);
    }
}

const bulkRetrieveBookingsRequestSchema = object({ bookingIds: ['booking_ids', array(string())] });

const addressSchema = object({
    addressLine1: ['address_line_1', optional(nullable(string()))],
    addressLine2: ['address_line_2', optional(nullable(string()))],
    addressLine3: ['address_line_3', optional(nullable(string()))],
    locality: ['locality', optional(nullable(string()))],
    sublocality: ['sublocality', optional(nullable(string()))],
    sublocality2: ['sublocality_2', optional(nullable(string()))],
    sublocality3: ['sublocality_3', optional(nullable(string()))],
    administrativeDistrictLevel1: [
        'administrative_district_level_1',
        optional(nullable(string())),
    ],
    administrativeDistrictLevel2: [
        'administrative_district_level_2',
        optional(nullable(string())),
    ],
    administrativeDistrictLevel3: [
        'administrative_district_level_3',
        optional(nullable(string())),
    ],
    postalCode: ['postal_code', optional(nullable(string()))],
    country: ['country', optional(string())],
    firstName: ['first_name', optional(nullable(string()))],
    lastName: ['last_name', optional(nullable(string()))],
});

const appointmentSegmentSchema = object({
    durationMinutes: ['duration_minutes', optional(nullable(number()))],
    serviceVariationId: ['service_variation_id', optional(nullable(string()))],
    teamMemberId: ['team_member_id', string()],
    serviceVariationVersion: [
        'service_variation_version',
        optional(nullable(bigint())),
    ],
    intermissionMinutes: ['intermission_minutes', optional(number())],
    anyTeamMember: ['any_team_member', optional(boolean())],
    resourceIds: ['resource_ids', optional(array(string()))],
});

const bookingCreatorDetailsSchema = object({
    creatorType: ['creator_type', optional(string())],
    teamMemberId: ['team_member_id', optional(string())],
    customerId: ['customer_id', optional(string())],
});

const bookingSchema = object({
    id: ['id', optional(string())],
    version: ['version', optional(number())],
    status: ['status', optional(string())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    startAt: ['start_at', optional(nullable(string()))],
    locationId: ['location_id', optional(nullable(string()))],
    customerId: ['customer_id', optional(nullable(string()))],
    customerNote: ['customer_note', optional(nullable(string()))],
    sellerNote: ['seller_note', optional(nullable(string()))],
    appointmentSegments: [
        'appointment_segments',
        optional(nullable(array(lazy(() => appointmentSegmentSchema)))),
    ],
    transitionTimeMinutes: ['transition_time_minutes', optional(number())],
    allDay: ['all_day', optional(boolean())],
    locationType: ['location_type', optional(string())],
    creatorDetails: [
        'creator_details',
        optional(lazy(() => bookingCreatorDetailsSchema)),
    ],
    source: ['source', optional(string())],
    address: ['address', optional(lazy(() => addressSchema))],
});

const retrieveBookingResponseSchema = object({
    booking: ['booking', optional(lazy(() => bookingSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkRetrieveBookingsResponseSchema = object({
    bookings: [
        'bookings',
        optional(dict(lazy(() => retrieveBookingResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkRetrieveTeamMemberBookingProfilesRequestSchema = object({ teamMemberIds: ['team_member_ids', array(string())] });

const teamMemberBookingProfileSchema = object({
    teamMemberId: ['team_member_id', optional(string())],
    description: ['description', optional(string())],
    displayName: ['display_name', optional(string())],
    isBookable: ['is_bookable', optional(nullable(boolean()))],
    profileImageUrl: ['profile_image_url', optional(string())],
});

const retrieveTeamMemberBookingProfileResponseSchema = object({
    teamMemberBookingProfile: [
        'team_member_booking_profile',
        optional(lazy(() => teamMemberBookingProfileSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkRetrieveTeamMemberBookingProfilesResponseSchema = object({
    teamMemberBookingProfiles: [
        'team_member_booking_profiles',
        optional(dict(lazy(() => retrieveTeamMemberBookingProfileResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const cancelBookingRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
    bookingVersion: ['booking_version', optional(nullable(number()))],
});

const cancelBookingResponseSchema = object({
    booking: ['booking', optional(lazy(() => bookingSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const createBookingRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(string())],
    booking: ['booking', lazy(() => bookingSchema)],
});

const createBookingResponseSchema = object({
    booking: ['booking', optional(lazy(() => bookingSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const listBookingsResponseSchema = object({
    bookings: ['bookings', optional(array(lazy(() => bookingSchema)))],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const locationBookingProfileSchema = object({
    locationId: ['location_id', optional(nullable(string()))],
    bookingSiteUrl: ['booking_site_url', optional(nullable(string()))],
    onlineBookingEnabled: [
        'online_booking_enabled',
        optional(nullable(boolean())),
    ],
});

const listLocationBookingProfilesResponseSchema = object({
    locationBookingProfiles: [
        'location_booking_profiles',
        optional(array(lazy(() => locationBookingProfileSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const listTeamMemberBookingProfilesResponseSchema = object({
    teamMemberBookingProfiles: [
        'team_member_booking_profiles',
        optional(array(lazy(() => teamMemberBookingProfileSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const moneySchema = object({
    amount: ['amount', optional(nullable(bigint()))],
    currency: ['currency', optional(string())],
});

const businessAppointmentSettingsSchema = object({
    locationTypes: ['location_types', optional(nullable(array(string())))],
    alignmentTime: ['alignment_time', optional(string())],
    minBookingLeadTimeSeconds: [
        'min_booking_lead_time_seconds',
        optional(nullable(number())),
    ],
    maxBookingLeadTimeSeconds: [
        'max_booking_lead_time_seconds',
        optional(nullable(number())),
    ],
    anyTeamMemberBookingEnabled: [
        'any_team_member_booking_enabled',
        optional(nullable(boolean())),
    ],
    multipleServiceBookingEnabled: [
        'multiple_service_booking_enabled',
        optional(nullable(boolean())),
    ],
    maxAppointmentsPerDayLimitType: [
        'max_appointments_per_day_limit_type',
        optional(string()),
    ],
    maxAppointmentsPerDayLimit: [
        'max_appointments_per_day_limit',
        optional(nullable(number())),
    ],
    cancellationWindowSeconds: [
        'cancellation_window_seconds',
        optional(nullable(number())),
    ],
    cancellationFeeMoney: [
        'cancellation_fee_money',
        optional(lazy(() => moneySchema)),
    ],
    cancellationPolicy: ['cancellation_policy', optional(string())],
    cancellationPolicyText: [
        'cancellation_policy_text',
        optional(nullable(string())),
    ],
    skipBookingFlowStaffSelection: [
        'skip_booking_flow_staff_selection',
        optional(nullable(boolean())),
    ],
});

const businessBookingProfileSchema = object({
    sellerId: ['seller_id', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
    bookingEnabled: ['booking_enabled', optional(nullable(boolean()))],
    customerTimezoneChoice: ['customer_timezone_choice', optional(string())],
    bookingPolicy: ['booking_policy', optional(string())],
    allowUserCancel: ['allow_user_cancel', optional(nullable(boolean()))],
    businessAppointmentSettings: [
        'business_appointment_settings',
        optional(lazy(() => businessAppointmentSettingsSchema)),
    ],
    supportSellerLevelWrites: [
        'support_seller_level_writes',
        optional(nullable(boolean())),
    ],
});

const retrieveBusinessBookingProfileResponseSchema = object({
    businessBookingProfile: [
        'business_booking_profile',
        optional(lazy(() => businessBookingProfileSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveLocationBookingProfileResponseSchema = object({
    locationBookingProfile: [
        'location_booking_profile',
        optional(lazy(() => locationBookingProfileSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const filterValueSchema = object({
    all: ['all', optional(nullable(array(string())))],
    any: ['any', optional(nullable(array(string())))],
    none: ['none', optional(nullable(array(string())))],
});

const segmentFilterSchema = object({
    serviceVariationId: ['service_variation_id', string()],
    teamMemberIdFilter: [
        'team_member_id_filter',
        optional(lazy(() => filterValueSchema)),
    ],
});

const timeRangeSchema = object({
    startAt: ['start_at', optional(nullable(string()))],
    endAt: ['end_at', optional(nullable(string()))],
});

const searchAvailabilityFilterSchema = object({
    startAtRange: ['start_at_range', lazy(() => timeRangeSchema)],
    locationId: ['location_id', optional(nullable(string()))],
    segmentFilters: [
        'segment_filters',
        optional(nullable(array(lazy(() => segmentFilterSchema)))),
    ],
    bookingId: ['booking_id', optional(nullable(string()))],
});

const searchAvailabilityQuerySchema = object({ filter: ['filter', lazy(() => searchAvailabilityFilterSchema)] });

const searchAvailabilityRequestSchema = object({ query: ['query', lazy(() => searchAvailabilityQuerySchema)] });

const availabilitySchema = object({
    startAt: ['start_at', optional(nullable(string()))],
    locationId: ['location_id', optional(string())],
    appointmentSegments: [
        'appointment_segments',
        optional(nullable(array(lazy(() => appointmentSegmentSchema)))),
    ],
});

const searchAvailabilityResponseSchema = object({
    availabilities: [
        'availabilities',
        optional(array(lazy(() => availabilitySchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateBookingRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
    booking: ['booking', lazy(() => bookingSchema)],
});

const updateBookingResponseSchema = object({
    booking: ['booking', optional(lazy(() => bookingSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class BookingsApi extends BaseApi {
    /**
     * Retrieve a collection of bookings.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_READ` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_READ` and
     * `APPOINTMENTS_READ` for the OAuth scope.
     *
     * @param limit          The maximum number of results per page to return in a paged response.
     * @param cursor         The pagination cursor from the preceding response to return the next page of the
     *                                 results. Do not set this when retrieving the first page of the results.
     * @param customerId     The [customer](entity:Customer) for whom to retrieve bookings. If this is not set,
     *                                 bookings for all customers are retrieved.
     * @param teamMemberId   The team member for whom to retrieve bookings. If this is not set, bookings of
     *                                 all members are retrieved.
     * @param locationId     The location for which to retrieve bookings. If this is not set, all locations'
     *                                 bookings are retrieved.
     * @param startAtMin     The RFC 3339 timestamp specifying the earliest of the start time. If this is not
     *                                 set, the current time is used.
     * @param startAtMax     The RFC 3339 timestamp specifying the latest of the start time. If this is not
     *                                 set, the time of 31 days after `start_at_min` is used.
     * @return Response from the API call
     */
    async listBookings(limit, cursor, customerId, teamMemberId, locationId, startAtMin, startAtMax, requestOptions) {
        const req = this.createRequest('GET', '/v2/bookings');
        const mapped = req.prepareArgs({
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
            customerId: [customerId, optional(string())],
            teamMemberId: [teamMemberId, optional(string())],
            locationId: [locationId, optional(string())],
            startAtMin: [startAtMin, optional(string())],
            startAtMax: [startAtMax, optional(string())],
        });
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.query('customer_id', mapped.customerId);
        req.query('team_member_id', mapped.teamMemberId);
        req.query('location_id', mapped.locationId);
        req.query('start_at_min', mapped.startAtMin);
        req.query('start_at_max', mapped.startAtMax);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listBookingsResponseSchema, requestOptions);
    }
    /**
     * Creates a booking.
     *
     * The required input must include the following:
     * - `Booking.location_id`
     * - `Booking.start_at`
     * - `Booking.AppointmentSegment.team_member_id`
     * - `Booking.AppointmentSegment.service_variation_id`
     * - `Booking.AppointmentSegment.service_variation_version`
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_WRITE` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_WRITE` and
     * `APPOINTMENTS_WRITE` for the OAuth scope.
     *
     * For calls to this endpoint with seller-level permissions to succeed, the seller must have subscribed
     * to *Appointments Plus*
     * or *Appointments Premium*.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                    the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createBooking(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/bookings');
        const mapped = req.prepareArgs({
            body: [body, createBookingRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createBookingResponseSchema, requestOptions);
    }
    /**
     * Searches for availabilities for booking.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_READ` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_READ` and
     * `APPOINTMENTS_READ` for the OAuth scope.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                         See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async searchAvailability(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/bookings/availability/search');
        const mapped = req.prepareArgs({
            body: [body, searchAvailabilityRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchAvailabilityResponseSchema, requestOptions);
    }
    /**
     * Bulk-Retrieves a list of bookings by booking IDs.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_READ` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_READ` and
     * `APPOINTMENTS_READ` for the OAuth scope.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                           See the corresponding object definition for field
     *                                                           details.
     * @return Response from the API call
     */
    async bulkRetrieveBookings(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/bookings/bulk-retrieve');
        const mapped = req.prepareArgs({
            body: [body, bulkRetrieveBookingsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkRetrieveBookingsResponseSchema, requestOptions);
    }
    /**
     * Retrieves a seller's booking profile.
     *
     * @return Response from the API call
     */
    async retrieveBusinessBookingProfile(requestOptions) {
        const req = this.createRequest('GET', '/v2/bookings/business-booking-profile');
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveBusinessBookingProfileResponseSchema, requestOptions);
    }
    /**
     * Lists location booking profiles of a seller.
     *
     * @param limit  The maximum number of results to return in a paged response.
     * @param cursor The pagination cursor from the preceding response to return the next page of the results.
     *                         Do not set this when retrieving the first page of the results.
     * @return Response from the API call
     */
    async listLocationBookingProfiles(limit, cursor, requestOptions) {
        const req = this.createRequest('GET', '/v2/bookings/location-booking-profiles');
        const mapped = req.prepareArgs({
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
        });
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listLocationBookingProfilesResponseSchema, requestOptions);
    }
    /**
     * Retrieves a seller's location booking profile.
     *
     * @param locationId  The ID of the location to retrieve the booking profile.
     * @return Response from the API call
     */
    async retrieveLocationBookingProfile(locationId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ locationId: [locationId, string()] });
        req.appendTemplatePath `/v2/bookings/location-booking-profiles/${mapped.locationId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveLocationBookingProfileResponseSchema, requestOptions);
    }
    /**
     * Lists booking profiles for team members.
     *
     * @param bookableOnly  Indicates whether to include only bookable team members in the returned result
     *                                 (`true`) or not (`false`).
     * @param limit         The maximum number of results to return in a paged response.
     * @param cursor        The pagination cursor from the preceding response to return the next page of the
     *                                 results. Do not set this when retrieving the first page of the results.
     * @param locationId    Indicates whether to include only team members enabled at the given location in
     *                                 the returned result.
     * @return Response from the API call
     */
    async listTeamMemberBookingProfiles(bookableOnly, limit, cursor, locationId, requestOptions) {
        const req = this.createRequest('GET', '/v2/bookings/team-member-booking-profiles');
        const mapped = req.prepareArgs({
            bookableOnly: [bookableOnly, optional(boolean())],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
            locationId: [locationId, optional(string())],
        });
        req.query('bookable_only', mapped.bookableOnly);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.query('location_id', mapped.locationId);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listTeamMemberBookingProfilesResponseSchema, requestOptions);
    }
    /**
     * Retrieves one or more team members' booking profiles.
     *
     * @param body         An object containing the fields to
     *                                                                            POST for the request.  See the
     *                                                                            corresponding object definition for
     *                                                                            field details.
     * @return Response from the API call
     */
    async bulkRetrieveTeamMemberBookingProfiles(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/bookings/team-member-booking-profiles/bulk-retrieve');
        const mapped = req.prepareArgs({
            body: [body, bulkRetrieveTeamMemberBookingProfilesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkRetrieveTeamMemberBookingProfilesResponseSchema, requestOptions);
    }
    /**
     * Retrieves a team member's booking profile.
     *
     * @param teamMemberId   The ID of the team member to retrieve.
     * @return Response from the API call
     */
    async retrieveTeamMemberBookingProfile(teamMemberId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ teamMemberId: [teamMemberId, string()] });
        req.appendTemplatePath `/v2/bookings/team-member-booking-profiles/${mapped.teamMemberId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveTeamMemberBookingProfileResponseSchema, requestOptions);
    }
    /**
     * Retrieves a booking.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_READ` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_READ` and
     * `APPOINTMENTS_READ` for the OAuth scope.
     *
     * @param bookingId  The ID of the [Booking](entity:Booking) object representing the to-be-retrieved
     *                             booking.
     * @return Response from the API call
     */
    async retrieveBooking(bookingId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ bookingId: [bookingId, string()] });
        req.appendTemplatePath `/v2/bookings/${mapped.bookingId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveBookingResponseSchema, requestOptions);
    }
    /**
     * Updates a booking.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_WRITE` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_WRITE` and
     * `APPOINTMENTS_WRITE` for the OAuth scope.
     *
     * For calls to this endpoint with seller-level permissions to succeed, the seller must have subscribed
     * to *Appointments Plus*
     * or *Appointments Premium*.
     *
     * @param bookingId    The ID of the [Booking](entity:Booking) object representing
     *                                                    the to-be-updated booking.
     * @param body         An object containing the fields to POST for the request.  See
     *                                                    the corresponding object definition for field details.
     * @return Response from the API call
     */
    async updateBooking(bookingId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            bookingId: [bookingId, string()],
            body: [body, updateBookingRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/bookings/${mapped.bookingId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateBookingResponseSchema, requestOptions);
    }
    /**
     * Cancels an existing booking.
     *
     * To call this endpoint with buyer-level permissions, set `APPOINTMENTS_WRITE` for the OAuth scope.
     * To call this endpoint with seller-level permissions, set `APPOINTMENTS_ALL_WRITE` and
     * `APPOINTMENTS_WRITE` for the OAuth scope.
     *
     * For calls to this endpoint with seller-level permissions to succeed, the seller must have subscribed
     * to *Appointments Plus*
     * or *Appointments Premium*.
     *
     * @param bookingId    The ID of the [Booking](entity:Booking) object representing
     *                                                    the to-be-cancelled booking.
     * @param body         An object containing the fields to POST for the request.  See
     *                                                    the corresponding object definition for field details.
     * @return Response from the API call
     */
    async cancelBooking(bookingId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            bookingId: [bookingId, string()],
            body: [body, cancelBookingRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/bookings/${mapped.bookingId}/cancel`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(cancelBookingResponseSchema, requestOptions);
    }
}

const cardSchema = object({
    id: ['id', optional(string())],
    cardBrand: ['card_brand', optional(string())],
    last4: ['last_4', optional(string())],
    expMonth: ['exp_month', optional(nullable(bigint()))],
    expYear: ['exp_year', optional(nullable(bigint()))],
    cardholderName: ['cardholder_name', optional(nullable(string()))],
    billingAddress: ['billing_address', optional(lazy(() => addressSchema))],
    fingerprint: ['fingerprint', optional(string())],
    customerId: ['customer_id', optional(nullable(string()))],
    merchantId: ['merchant_id', optional(string())],
    referenceId: ['reference_id', optional(nullable(string()))],
    enabled: ['enabled', optional(boolean())],
    cardType: ['card_type', optional(string())],
    prepaidType: ['prepaid_type', optional(string())],
    bin: ['bin', optional(string())],
    version: ['version', optional(bigint())],
    cardCoBrand: ['card_co_brand', optional(string())],
});

const createCardRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    sourceId: ['source_id', string()],
    verificationToken: ['verification_token', optional(string())],
    card: ['card', lazy(() => cardSchema)],
});

const createCardResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    card: ['card', optional(lazy(() => cardSchema))],
});

const disableCardResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    card: ['card', optional(lazy(() => cardSchema))],
});

const listCardsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    cards: ['cards', optional(array(lazy(() => cardSchema)))],
    cursor: ['cursor', optional(string())],
});

const retrieveCardResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    card: ['card', optional(lazy(() => cardSchema))],
});

class CardsApi extends BaseApi {
    /**
     * Retrieves a list of cards owned by the account making the request.
     * A max of 25 cards will be returned.
     *
     * @param cursor           A pagination cursor returned by a previous call to this endpoint. Provide this
     *                                    to retrieve the next set of results for your original query.  See
     *                                    [Pagination](https://developer.squareup.com/docs/build-basics/common-api-
     *                                    patterns/pagination) for more information.
     * @param customerId       Limit results to cards associated with the customer supplied. By default, all
     *                                    cards owned by the merchant are returned.
     * @param includeDisabled  Includes disabled cards. By default, all enabled cards owned by the merchant
     *                                    are returned.
     * @param referenceId      Limit results to cards associated with the reference_id supplied.
     * @param sortOrder        Sorts the returned list by when the card was created with the specified order.
     *                                    This field defaults to ASC.
     * @return Response from the API call
     */
    async listCards(cursor, customerId, includeDisabled, referenceId, sortOrder, requestOptions) {
        const req = this.createRequest('GET', '/v2/cards');
        const mapped = req.prepareArgs({
            cursor: [cursor, optional(string())],
            customerId: [customerId, optional(string())],
            includeDisabled: [includeDisabled, optional(boolean())],
            referenceId: [referenceId, optional(string())],
            sortOrder: [sortOrder, optional(string())],
        });
        req.query('cursor', mapped.cursor);
        req.query('customer_id', mapped.customerId);
        req.query('include_disabled', mapped.includeDisabled);
        req.query('reference_id', mapped.referenceId);
        req.query('sort_order', mapped.sortOrder);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listCardsResponseSchema, requestOptions);
    }
    /**
     * Adds a card on file to an existing merchant.
     *
     * @param body         An object containing the fields to POST for the request.  See the
     *                                                 corresponding object definition for field details.
     * @return Response from the API call
     */
    async createCard(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/cards');
        const mapped = req.prepareArgs({ body: [body, createCardRequestSchema] });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createCardResponseSchema, requestOptions);
    }
    /**
     * Retrieves details for a specific Card.
     *
     * @param cardId  Unique ID for the desired Card.
     * @return Response from the API call
     */
    async retrieveCard(cardId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ cardId: [cardId, string()] });
        req.appendTemplatePath `/v2/cards/${mapped.cardId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveCardResponseSchema, requestOptions);
    }
    /**
     * Disables the card, preventing any further updates or charges.
     * Disabling an already disabled card is allowed but has no effect.
     *
     * @param cardId  Unique ID for the desired Card.
     * @return Response from the API call
     */
    async disableCard(cardId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({ cardId: [cardId, string()] });
        req.appendTemplatePath `/v2/cards/${mapped.cardId}/disable`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(disableCardResponseSchema, requestOptions);
    }
}

const cashDrawerShiftEventSchema = object({
    id: ['id', optional(string())],
    eventType: ['event_type', optional(string())],
    eventMoney: ['event_money', optional(lazy(() => moneySchema))],
    createdAt: ['created_at', optional(string())],
    description: ['description', optional(nullable(string()))],
    teamMemberId: ['team_member_id', optional(string())],
});

const listCashDrawerShiftEventsResponseSchema = object({
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    cashDrawerShiftEvents: [
        'cash_drawer_shift_events',
        optional(array(lazy(() => cashDrawerShiftEventSchema))),
    ],
});

const cashDrawerShiftSummarySchema = object({
    id: ['id', optional(string())],
    state: ['state', optional(string())],
    openedAt: ['opened_at', optional(nullable(string()))],
    endedAt: ['ended_at', optional(nullable(string()))],
    closedAt: ['closed_at', optional(nullable(string()))],
    description: ['description', optional(nullable(string()))],
    openedCashMoney: ['opened_cash_money', optional(lazy(() => moneySchema))],
    expectedCashMoney: [
        'expected_cash_money',
        optional(lazy(() => moneySchema)),
    ],
    closedCashMoney: ['closed_cash_money', optional(lazy(() => moneySchema))],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    locationId: ['location_id', optional(string())],
});

const listCashDrawerShiftsResponseSchema = object({
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    cashDrawerShifts: [
        'cash_drawer_shifts',
        optional(array(lazy(() => cashDrawerShiftSummarySchema))),
    ],
});

const cashDrawerDeviceSchema = object({
    id: ['id', optional(string())],
    name: ['name', optional(nullable(string()))],
});

const cashDrawerShiftSchema = object({
    id: ['id', optional(string())],
    state: ['state', optional(string())],
    openedAt: ['opened_at', optional(nullable(string()))],
    endedAt: ['ended_at', optional(nullable(string()))],
    closedAt: ['closed_at', optional(nullable(string()))],
    description: ['description', optional(nullable(string()))],
    openedCashMoney: ['opened_cash_money', optional(lazy(() => moneySchema))],
    cashPaymentMoney: ['cash_payment_money', optional(lazy(() => moneySchema))],
    cashRefundsMoney: ['cash_refunds_money', optional(lazy(() => moneySchema))],
    cashPaidInMoney: ['cash_paid_in_money', optional(lazy(() => moneySchema))],
    cashPaidOutMoney: ['cash_paid_out_money', optional(lazy(() => moneySchema))],
    expectedCashMoney: ['expected_cash_money', optional(lazy(() => moneySchema))],
    closedCashMoney: ['closed_cash_money', optional(lazy(() => moneySchema))],
    device: ['device', optional(lazy(() => cashDrawerDeviceSchema))],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    locationId: ['location_id', optional(string())],
    teamMemberIds: ['team_member_ids', optional(array(string()))],
    openingTeamMemberId: ['opening_team_member_id', optional(string())],
    endingTeamMemberId: ['ending_team_member_id', optional(string())],
    closingTeamMemberId: ['closing_team_member_id', optional(string())],
});

const retrieveCashDrawerShiftResponseSchema = object({
    cashDrawerShift: [
        'cash_drawer_shift',
        optional(lazy(() => cashDrawerShiftSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class CashDrawersApi extends BaseApi {
    /**
     * Provides the details for all of the cash drawer shifts for a location
     * in a date range.
     *
     * @param locationId  The ID of the location to query for a list of cash drawer shifts.
     * @param sortOrder   The order in which cash drawer shifts are listed in the response, based on their
     *                              opened_at field. Default value: ASC
     * @param beginTime   The inclusive start time of the query on opened_at, in ISO 8601 format.
     * @param endTime     The exclusive end date of the query on opened_at, in ISO 8601 format.
     * @param limit       Number of cash drawer shift events in a page of results (200 by default, 1000 max).
     * @param cursor      Opaque cursor for fetching the next page of results.
     * @return Response from the API call
     */
    async listCashDrawerShifts(locationId, sortOrder, beginTime, endTime, limit, cursor, requestOptions) {
        const req = this.createRequest('GET', '/v2/cash-drawers/shifts');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            sortOrder: [sortOrder, optional(string())],
            beginTime: [beginTime, optional(string())],
            endTime: [endTime, optional(string())],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
        });
        req.query('location_id', mapped.locationId);
        req.query('sort_order', mapped.sortOrder);
        req.query('begin_time', mapped.beginTime);
        req.query('end_time', mapped.endTime);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listCashDrawerShiftsResponseSchema, requestOptions);
    }
    /**
     * Provides the summary details for a single cash drawer shift. See
     * [ListCashDrawerShiftEvents]($e/CashDrawers/ListCashDrawerShiftEvents) for a list of cash drawer
     * shift events.
     *
     * @param locationId  The ID of the location to retrieve cash drawer shifts from.
     * @param shiftId     The shift ID.
     * @return Response from the API call
     */
    async retrieveCashDrawerShift(locationId, shiftId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            shiftId: [shiftId, string()],
        });
        req.query('location_id', mapped.locationId);
        req.appendTemplatePath `/v2/cash-drawers/shifts/${mapped.shiftId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveCashDrawerShiftResponseSchema, requestOptions);
    }
    /**
     * Provides a paginated list of events for a single cash drawer shift.
     *
     * @param locationId  The ID of the location to list cash drawer shifts for.
     * @param shiftId     The shift ID.
     * @param limit       Number of resources to be returned in a page of results (200 by default, 1000 max).
     * @param cursor      Opaque cursor for fetching the next page of results.
     * @return Response from the API call
     */
    async listCashDrawerShiftEvents(locationId, shiftId, limit, cursor, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            shiftId: [shiftId, string()],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
        });
        req.query('location_id', mapped.locationId);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.appendTemplatePath `/v2/cash-drawers/shifts/${mapped.shiftId}/events`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(listCashDrawerShiftEventsResponseSchema, requestOptions);
    }
}

const batchDeleteCatalogObjectsRequestSchema = object({ objectIds: ['object_ids', optional(nullable(array(string())))] });

const batchDeleteCatalogObjectsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    deletedObjectIds: ['deleted_object_ids', optional(array(string()))],
    deletedAt: ['deleted_at', optional(string())],
});

const batchRetrieveCatalogObjectsRequestSchema = object({
    objectIds: ['object_ids', array(string())],
    includeRelatedObjects: [
        'include_related_objects',
        optional(nullable(boolean())),
    ],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
    includeDeletedObjects: [
        'include_deleted_objects',
        optional(nullable(boolean())),
    ],
    includeCategoryPathToRoot: [
        'include_category_path_to_root',
        optional(nullable(boolean())),
    ],
});

const catalogAvailabilityPeriodSchema = object({
    startLocalTime: ['start_local_time', optional(nullable(string()))],
    endLocalTime: ['end_local_time', optional(nullable(string()))],
    dayOfWeek: ['day_of_week', optional(string())],
});

const catalogEcomSeoDataSchema = object({
    pageTitle: ['page_title', optional(nullable(string()))],
    pageDescription: ['page_description', optional(nullable(string()))],
    permalink: ['permalink', optional(nullable(string()))],
});

const catalogObjectCategorySchema = object({
    id: ['id', optional(string())],
    ordinal: ['ordinal', optional(nullable(bigint()))],
});

const categoryPathToRootNodeSchema = object({
    categoryId: ['category_id', optional(nullable(string()))],
    categoryName: ['category_name', optional(nullable(string()))],
});

const catalogCategorySchema = object({
    name: ['name', optional(nullable(string()))],
    imageIds: ['image_ids', optional(nullable(array(string())))],
    categoryType: ['category_type', optional(string())],
    parentCategory: [
        'parent_category',
        optional(lazy(() => catalogObjectCategorySchema)),
    ],
    isTopLevel: ['is_top_level', optional(nullable(boolean()))],
    channels: ['channels', optional(nullable(array(string())))],
    availabilityPeriodIds: [
        'availability_period_ids',
        optional(nullable(array(string()))),
    ],
    onlineVisibility: ['online_visibility', optional(nullable(boolean()))],
    rootCategory: ['root_category', optional(string())],
    ecomSeoData: [
        'ecom_seo_data',
        optional(lazy(() => catalogEcomSeoDataSchema)),
    ],
    pathToRoot: [
        'path_to_root',
        optional(nullable(array(lazy(() => categoryPathToRootNodeSchema)))),
    ],
});

const catalogCustomAttributeDefinitionNumberConfigSchema = object({ precision: ['precision', optional(nullable(number()))] });

const catalogCustomAttributeDefinitionSelectionConfigCustomAttributeSelectionSchema = object({ uid: ['uid', optional(nullable(string()))], name: ['name', string()] });

const catalogCustomAttributeDefinitionSelectionConfigSchema = object({
    maxAllowedSelections: [
        'max_allowed_selections',
        optional(nullable(number())),
    ],
    allowedSelections: [
        'allowed_selections',
        optional(nullable(array(lazy(() => catalogCustomAttributeDefinitionSelectionConfigCustomAttributeSelectionSchema)))),
    ],
});

const catalogCustomAttributeDefinitionStringConfigSchema = object({ enforceUniqueness: ['enforce_uniqueness', optional(nullable(boolean()))] });

const sourceApplicationSchema = object({
    product: ['product', optional(string())],
    applicationId: ['application_id', optional(nullable(string()))],
    name: ['name', optional(nullable(string()))],
});

const catalogCustomAttributeDefinitionSchema = object({
    type: ['type', string()],
    name: ['name', string()],
    description: ['description', optional(nullable(string()))],
    sourceApplication: [
        'source_application',
        optional(lazy(() => sourceApplicationSchema)),
    ],
    allowedObjectTypes: ['allowed_object_types', array(string())],
    sellerVisibility: ['seller_visibility', optional(string())],
    appVisibility: ['app_visibility', optional(string())],
    stringConfig: [
        'string_config',
        optional(lazy(() => catalogCustomAttributeDefinitionStringConfigSchema)),
    ],
    numberConfig: [
        'number_config',
        optional(lazy(() => catalogCustomAttributeDefinitionNumberConfigSchema)),
    ],
    selectionConfig: [
        'selection_config',
        optional(lazy(() => catalogCustomAttributeDefinitionSelectionConfigSchema)),
    ],
    customAttributeUsageCount: [
        'custom_attribute_usage_count',
        optional(number()),
    ],
    key: ['key', optional(nullable(string()))],
});

const catalogCustomAttributeValueSchema = object({
    name: ['name', optional(nullable(string()))],
    stringValue: ['string_value', optional(nullable(string()))],
    customAttributeDefinitionId: [
        'custom_attribute_definition_id',
        optional(string()),
    ],
    type: ['type', optional(string())],
    numberValue: ['number_value', optional(nullable(string()))],
    booleanValue: ['boolean_value', optional(nullable(boolean()))],
    selectionUidValues: [
        'selection_uid_values',
        optional(nullable(array(string()))),
    ],
    key: ['key', optional(string())],
});

const catalogDiscountSchema = object({
    name: ['name', optional(nullable(string()))],
    discountType: ['discount_type', optional(string())],
    percentage: ['percentage', optional(nullable(string()))],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    pinRequired: ['pin_required', optional(nullable(boolean()))],
    labelColor: ['label_color', optional(nullable(string()))],
    modifyTaxBasis: ['modify_tax_basis', optional(string())],
    maximumAmountMoney: [
        'maximum_amount_money',
        optional(lazy(() => moneySchema)),
    ],
});

const catalogImageSchema = object({
    name: ['name', optional(nullable(string()))],
    url: ['url', optional(nullable(string()))],
    caption: ['caption', optional(nullable(string()))],
    photoStudioOrderId: ['photo_studio_order_id', optional(nullable(string()))],
});

const catalogItemFoodAndBeverageDetailsDietaryPreferenceSchema = object({
    type: ['type', optional(string())],
    standardName: ['standard_name', optional(string())],
    customName: ['custom_name', optional(nullable(string()))],
});

const catalogItemFoodAndBeverageDetailsIngredientSchema = object({
    type: ['type', optional(string())],
    standardName: ['standard_name', optional(string())],
    customName: ['custom_name', optional(nullable(string()))],
});

const catalogItemFoodAndBeverageDetailsSchema = object({
    calorieCount: ['calorie_count', optional(nullable(number()))],
    dietaryPreferences: [
        'dietary_preferences',
        optional(nullable(array(lazy(() => catalogItemFoodAndBeverageDetailsDietaryPreferenceSchema)))),
    ],
    ingredients: [
        'ingredients',
        optional(nullable(array(lazy(() => catalogItemFoodAndBeverageDetailsIngredientSchema)))),
    ],
});

const catalogModifierOverrideSchema = object({
    modifierId: ['modifier_id', string()],
    onByDefault: ['on_by_default', optional(nullable(boolean()))],
});

const catalogItemModifierListInfoSchema = object({
    modifierListId: ['modifier_list_id', string()],
    modifierOverrides: [
        'modifier_overrides',
        optional(nullable(array(lazy(() => catalogModifierOverrideSchema)))),
    ],
    minSelectedModifiers: [
        'min_selected_modifiers',
        optional(nullable(number())),
    ],
    maxSelectedModifiers: [
        'max_selected_modifiers',
        optional(nullable(number())),
    ],
    enabled: ['enabled', optional(nullable(boolean()))],
    ordinal: ['ordinal', optional(nullable(number()))],
});

const catalogItemOptionForItemSchema = object({ itemOptionId: ['item_option_id', optional(nullable(string()))] });

const catalogItemSchema = object({
    name: ['name', optional(nullable(string()))],
    description: ['description', optional(nullable(string()))],
    abbreviation: ['abbreviation', optional(nullable(string()))],
    labelColor: ['label_color', optional(nullable(string()))],
    isTaxable: ['is_taxable', optional(nullable(boolean()))],
    availableOnline: ['available_online', optional(nullable(boolean()))],
    availableForPickup: ['available_for_pickup', optional(nullable(boolean()))],
    availableElectronically: [
        'available_electronically',
        optional(nullable(boolean())),
    ],
    categoryId: ['category_id', optional(nullable(string()))],
    taxIds: ['tax_ids', optional(nullable(array(string())))],
    modifierListInfo: [
        'modifier_list_info',
        optional(nullable(array(lazy(() => catalogItemModifierListInfoSchema)))),
    ],
    variations: [
        'variations',
        optional(nullable(array(lazy(() => catalogObjectSchema)))),
    ],
    productType: ['product_type', optional(string())],
    skipModifierScreen: ['skip_modifier_screen', optional(nullable(boolean()))],
    itemOptions: [
        'item_options',
        optional(nullable(array(lazy(() => catalogItemOptionForItemSchema)))),
    ],
    imageIds: ['image_ids', optional(nullable(array(string())))],
    sortName: ['sort_name', optional(nullable(string()))],
    categories: [
        'categories',
        optional(nullable(array(lazy(() => catalogObjectCategorySchema)))),
    ],
    descriptionHtml: ['description_html', optional(nullable(string()))],
    descriptionPlaintext: ['description_plaintext', optional(string())],
    channels: ['channels', optional(nullable(array(string())))],
    isArchived: ['is_archived', optional(nullable(boolean()))],
    ecomSeoData: [
        'ecom_seo_data',
        optional(lazy(() => catalogEcomSeoDataSchema)),
    ],
    foodAndBeverageDetails: [
        'food_and_beverage_details',
        optional(lazy(() => catalogItemFoodAndBeverageDetailsSchema)),
    ],
    reportingCategory: [
        'reporting_category',
        optional(lazy(() => catalogObjectCategorySchema)),
    ],
});

const catalogItemOptionSchema = object({
    name: ['name', optional(nullable(string()))],
    displayName: ['display_name', optional(nullable(string()))],
    description: ['description', optional(nullable(string()))],
    showColors: ['show_colors', optional(nullable(boolean()))],
    values: [
        'values',
        optional(nullable(array(lazy(() => catalogObjectSchema)))),
    ],
});

const catalogItemOptionValueSchema = object({
    itemOptionId: ['item_option_id', optional(nullable(string()))],
    name: ['name', optional(nullable(string()))],
    description: ['description', optional(nullable(string()))],
    color: ['color', optional(nullable(string()))],
    ordinal: ['ordinal', optional(nullable(number()))],
});

const catalogItemOptionValueForItemVariationSchema = object({
    itemOptionId: ['item_option_id', optional(nullable(string()))],
    itemOptionValueId: ['item_option_value_id', optional(nullable(string()))],
});

const catalogStockConversionSchema = object({
    stockableItemVariationId: ['stockable_item_variation_id', string()],
    stockableQuantity: ['stockable_quantity', string()],
    nonstockableQuantity: ['nonstockable_quantity', string()],
});

const itemVariationLocationOverridesSchema = object({
    locationId: ['location_id', optional(nullable(string()))],
    priceMoney: ['price_money', optional(lazy(() => moneySchema))],
    pricingType: ['pricing_type', optional(string())],
    trackInventory: ['track_inventory', optional(nullable(boolean()))],
    inventoryAlertType: ['inventory_alert_type', optional(string())],
    inventoryAlertThreshold: [
        'inventory_alert_threshold',
        optional(nullable(bigint())),
    ],
    soldOut: ['sold_out', optional(boolean())],
    soldOutValidUntil: ['sold_out_valid_until', optional(string())],
});

const catalogItemVariationSchema = object({
    itemId: ['item_id', optional(nullable(string()))],
    name: ['name', optional(nullable(string()))],
    sku: ['sku', optional(nullable(string()))],
    upc: ['upc', optional(nullable(string()))],
    ordinal: ['ordinal', optional(number())],
    pricingType: ['pricing_type', optional(string())],
    priceMoney: ['price_money', optional(lazy(() => moneySchema))],
    locationOverrides: [
        'location_overrides',
        optional(nullable(array(lazy(() => itemVariationLocationOverridesSchema)))),
    ],
    trackInventory: ['track_inventory', optional(nullable(boolean()))],
    inventoryAlertType: ['inventory_alert_type', optional(string())],
    inventoryAlertThreshold: [
        'inventory_alert_threshold',
        optional(nullable(bigint())),
    ],
    userData: ['user_data', optional(nullable(string()))],
    serviceDuration: ['service_duration', optional(nullable(bigint()))],
    availableForBooking: ['available_for_booking', optional(nullable(boolean()))],
    itemOptionValues: [
        'item_option_values',
        optional(nullable(array(lazy(() => catalogItemOptionValueForItemVariationSchema)))),
    ],
    measurementUnitId: ['measurement_unit_id', optional(nullable(string()))],
    sellable: ['sellable', optional(nullable(boolean()))],
    stockable: ['stockable', optional(nullable(boolean()))],
    imageIds: ['image_ids', optional(nullable(array(string())))],
    teamMemberIds: ['team_member_ids', optional(nullable(array(string())))],
    stockableConversion: [
        'stockable_conversion',
        optional(lazy(() => catalogStockConversionSchema)),
    ],
});

const measurementUnitCustomSchema = object({ name: ['name', string()], abbreviation: ['abbreviation', string()] });

const measurementUnitSchema = object({
    customUnit: [
        'custom_unit',
        optional(lazy(() => measurementUnitCustomSchema)),
    ],
    areaUnit: ['area_unit', optional(string())],
    lengthUnit: ['length_unit', optional(string())],
    volumeUnit: ['volume_unit', optional(string())],
    weightUnit: ['weight_unit', optional(string())],
    genericUnit: ['generic_unit', optional(string())],
    timeUnit: ['time_unit', optional(string())],
    type: ['type', optional(string())],
});

const catalogMeasurementUnitSchema = object({
    measurementUnit: [
        'measurement_unit',
        optional(lazy(() => measurementUnitSchema)),
    ],
    precision: ['precision', optional(nullable(number()))],
});

const modifierLocationOverridesSchema = object({
    locationId: ['location_id', optional(nullable(string()))],
    priceMoney: ['price_money', optional(lazy(() => moneySchema))],
    soldOut: ['sold_out', optional(boolean())],
});

const catalogModifierSchema = object({
    name: ['name', optional(nullable(string()))],
    priceMoney: ['price_money', optional(lazy(() => moneySchema))],
    ordinal: ['ordinal', optional(nullable(number()))],
    modifierListId: ['modifier_list_id', optional(nullable(string()))],
    locationOverrides: [
        'location_overrides',
        optional(nullable(array(lazy(() => modifierLocationOverridesSchema)))),
    ],
    imageId: ['image_id', optional(nullable(string()))],
});

const catalogModifierListSchema = object({
    name: ['name', optional(nullable(string()))],
    ordinal: ['ordinal', optional(nullable(number()))],
    selectionType: ['selection_type', optional(string())],
    modifiers: [
        'modifiers',
        optional(nullable(array(lazy(() => catalogObjectSchema)))),
    ],
    imageIds: ['image_ids', optional(nullable(array(string())))],
    modifierType: ['modifier_type', optional(string())],
    maxLength: ['max_length', optional(nullable(number()))],
    textRequired: ['text_required', optional(nullable(boolean()))],
    internalName: ['internal_name', optional(nullable(string()))],
});

const catalogPricingRuleSchema = object({
    name: ['name', optional(nullable(string()))],
    timePeriodIds: ['time_period_ids', optional(nullable(array(string())))],
    discountId: ['discount_id', optional(nullable(string()))],
    matchProductsId: ['match_products_id', optional(nullable(string()))],
    applyProductsId: ['apply_products_id', optional(nullable(string()))],
    excludeProductsId: ['exclude_products_id', optional(nullable(string()))],
    validFromDate: ['valid_from_date', optional(nullable(string()))],
    validFromLocalTime: ['valid_from_local_time', optional(nullable(string()))],
    validUntilDate: ['valid_until_date', optional(nullable(string()))],
    validUntilLocalTime: ['valid_until_local_time', optional(nullable(string()))],
    excludeStrategy: ['exclude_strategy', optional(string())],
    minimumOrderSubtotalMoney: [
        'minimum_order_subtotal_money',
        optional(lazy(() => moneySchema)),
    ],
    customerGroupIdsAny: [
        'customer_group_ids_any',
        optional(nullable(array(string()))),
    ],
});

const catalogProductSetSchema = object({
    name: ['name', optional(nullable(string()))],
    productIdsAny: ['product_ids_any', optional(nullable(array(string())))],
    productIdsAll: ['product_ids_all', optional(nullable(array(string())))],
    quantityExact: ['quantity_exact', optional(nullable(bigint()))],
    quantityMin: ['quantity_min', optional(nullable(bigint()))],
    quantityMax: ['quantity_max', optional(nullable(bigint()))],
    allProducts: ['all_products', optional(nullable(boolean()))],
});

const catalogQuickAmountSchema = object({
    type: ['type', string()],
    amount: ['amount', lazy(() => moneySchema)],
    score: ['score', optional(nullable(bigint()))],
    ordinal: ['ordinal', optional(nullable(bigint()))],
});

const catalogQuickAmountsSettingsSchema = object({
    option: ['option', string()],
    eligibleForAutoAmounts: [
        'eligible_for_auto_amounts',
        optional(nullable(boolean())),
    ],
    amounts: [
        'amounts',
        optional(nullable(array(lazy(() => catalogQuickAmountSchema)))),
    ],
});

const subscriptionPricingSchema = object({
    type: ['type', optional(string())],
    discountIds: ['discount_ids', optional(nullable(array(string())))],
    priceMoney: ['price_money', optional(lazy(() => moneySchema))],
});

const subscriptionPhaseSchema = object({
    uid: ['uid', optional(nullable(string()))],
    cadence: ['cadence', string()],
    periods: ['periods', optional(nullable(number()))],
    recurringPriceMoney: [
        'recurring_price_money',
        optional(lazy(() => moneySchema)),
    ],
    ordinal: ['ordinal', optional(nullable(bigint()))],
    pricing: ['pricing', optional(lazy(() => subscriptionPricingSchema))],
});

const catalogSubscriptionPlanSchema = object({
    name: ['name', string()],
    phases: [
        'phases',
        optional(nullable(array(lazy(() => subscriptionPhaseSchema)))),
    ],
    subscriptionPlanVariations: [
        'subscription_plan_variations',
        optional(nullable(array(lazy(() => catalogObjectSchema)))),
    ],
    eligibleItemIds: ['eligible_item_ids', optional(nullable(array(string())))],
    eligibleCategoryIds: [
        'eligible_category_ids',
        optional(nullable(array(string()))),
    ],
    allItems: ['all_items', optional(nullable(boolean()))],
});

const catalogSubscriptionPlanVariationSchema = object({
    name: ['name', string()],
    phases: ['phases', array(lazy(() => subscriptionPhaseSchema))],
    subscriptionPlanId: ['subscription_plan_id', optional(nullable(string()))],
    monthlyBillingAnchorDate: [
        'monthly_billing_anchor_date',
        optional(nullable(bigint())),
    ],
    canProrate: ['can_prorate', optional(nullable(boolean()))],
    successorPlanVariationId: [
        'successor_plan_variation_id',
        optional(nullable(string())),
    ],
});

const catalogTaxSchema = object({
    name: ['name', optional(nullable(string()))],
    calculationPhase: ['calculation_phase', optional(string())],
    inclusionType: ['inclusion_type', optional(string())],
    percentage: ['percentage', optional(nullable(string()))],
    appliesToCustomAmounts: [
        'applies_to_custom_amounts',
        optional(nullable(boolean())),
    ],
    enabled: ['enabled', optional(nullable(boolean()))],
    appliesToProductSetId: [
        'applies_to_product_set_id',
        optional(nullable(string())),
    ],
});

const catalogTimePeriodSchema = object({
    event: ['event', optional(nullable(string()))],
});

const catalogV1IdSchema = object({
    catalogV1Id: ['catalog_v1_id', optional(nullable(string()))],
    locationId: ['location_id', optional(nullable(string()))],
});

const catalogObjectSchema = object({
    type: ['type', string()],
    id: ['id', string()],
    updatedAt: ['updated_at', optional(string())],
    version: ['version', optional(bigint())],
    isDeleted: ['is_deleted', optional(nullable(boolean()))],
    customAttributeValues: [
        'custom_attribute_values',
        optional(nullable(dict(lazy(() => catalogCustomAttributeValueSchema)))),
    ],
    catalogV1Ids: [
        'catalog_v1_ids',
        optional(nullable(array(lazy(() => catalogV1IdSchema)))),
    ],
    presentAtAllLocations: [
        'present_at_all_locations',
        optional(nullable(boolean())),
    ],
    presentAtLocationIds: [
        'present_at_location_ids',
        optional(nullable(array(string()))),
    ],
    absentAtLocationIds: [
        'absent_at_location_ids',
        optional(nullable(array(string()))),
    ],
    itemData: ['item_data', optional(lazy(() => catalogItemSchema))],
    categoryData: ['category_data', optional(lazy(() => catalogCategorySchema))],
    itemVariationData: [
        'item_variation_data',
        optional(lazy(() => catalogItemVariationSchema)),
    ],
    taxData: ['tax_data', optional(lazy(() => catalogTaxSchema))],
    discountData: ['discount_data', optional(lazy(() => catalogDiscountSchema))],
    modifierListData: [
        'modifier_list_data',
        optional(lazy(() => catalogModifierListSchema)),
    ],
    modifierData: ['modifier_data', optional(lazy(() => catalogModifierSchema))],
    timePeriodData: [
        'time_period_data',
        optional(lazy(() => catalogTimePeriodSchema)),
    ],
    productSetData: [
        'product_set_data',
        optional(lazy(() => catalogProductSetSchema)),
    ],
    pricingRuleData: [
        'pricing_rule_data',
        optional(lazy(() => catalogPricingRuleSchema)),
    ],
    imageData: ['image_data', optional(lazy(() => catalogImageSchema))],
    measurementUnitData: [
        'measurement_unit_data',
        optional(lazy(() => catalogMeasurementUnitSchema)),
    ],
    subscriptionPlanData: [
        'subscription_plan_data',
        optional(lazy(() => catalogSubscriptionPlanSchema)),
    ],
    itemOptionData: [
        'item_option_data',
        optional(lazy(() => catalogItemOptionSchema)),
    ],
    itemOptionValueData: [
        'item_option_value_data',
        optional(lazy(() => catalogItemOptionValueSchema)),
    ],
    customAttributeDefinitionData: [
        'custom_attribute_definition_data',
        optional(lazy(() => catalogCustomAttributeDefinitionSchema)),
    ],
    quickAmountsSettingsData: [
        'quick_amounts_settings_data',
        optional(lazy(() => catalogQuickAmountsSettingsSchema)),
    ],
    subscriptionPlanVariationData: [
        'subscription_plan_variation_data',
        optional(lazy(() => catalogSubscriptionPlanVariationSchema)),
    ],
    availabilityPeriodData: [
        'availability_period_data',
        optional(lazy(() => catalogAvailabilityPeriodSchema)),
    ],
});

const batchRetrieveCatalogObjectsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    objects: ['objects', optional(array(lazy(() => catalogObjectSchema)))],
    relatedObjects: [
        'related_objects',
        optional(array(lazy(() => catalogObjectSchema))),
    ],
});

const catalogObjectBatchSchema = object({
    objects: ['objects', array(lazy(() => catalogObjectSchema))],
});

const batchUpsertCatalogObjectsRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    batches: ['batches', array(lazy(() => catalogObjectBatchSchema))],
});

const catalogIdMappingSchema = object({
    clientObjectId: ['client_object_id', optional(nullable(string()))],
    objectId: ['object_id', optional(nullable(string()))],
});

const batchUpsertCatalogObjectsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    objects: ['objects', optional(array(lazy(() => catalogObjectSchema)))],
    updatedAt: ['updated_at', optional(string())],
    idMappings: [
        'id_mappings',
        optional(array(lazy(() => catalogIdMappingSchema))),
    ],
});

const catalogInfoResponseLimitsSchema = object({
    batchUpsertMaxObjectsPerBatch: [
        'batch_upsert_max_objects_per_batch',
        optional(nullable(number())),
    ],
    batchUpsertMaxTotalObjects: [
        'batch_upsert_max_total_objects',
        optional(nullable(number())),
    ],
    batchRetrieveMaxObjectIds: [
        'batch_retrieve_max_object_ids',
        optional(nullable(number())),
    ],
    searchMaxPageLimit: ['search_max_page_limit', optional(nullable(number()))],
    batchDeleteMaxObjectIds: [
        'batch_delete_max_object_ids',
        optional(nullable(number())),
    ],
    updateItemTaxesMaxItemIds: [
        'update_item_taxes_max_item_ids',
        optional(nullable(number())),
    ],
    updateItemTaxesMaxTaxesToEnable: [
        'update_item_taxes_max_taxes_to_enable',
        optional(nullable(number())),
    ],
    updateItemTaxesMaxTaxesToDisable: [
        'update_item_taxes_max_taxes_to_disable',
        optional(nullable(number())),
    ],
    updateItemModifierListsMaxItemIds: [
        'update_item_modifier_lists_max_item_ids',
        optional(nullable(number())),
    ],
    updateItemModifierListsMaxModifierListsToEnable: [
        'update_item_modifier_lists_max_modifier_lists_to_enable',
        optional(nullable(number())),
    ],
    updateItemModifierListsMaxModifierListsToDisable: [
        'update_item_modifier_lists_max_modifier_lists_to_disable',
        optional(nullable(number())),
    ],
});

const standardUnitDescriptionSchema = object({
    unit: ['unit', optional(lazy(() => measurementUnitSchema))],
    name: ['name', optional(nullable(string()))],
    abbreviation: ['abbreviation', optional(nullable(string()))],
});

const standardUnitDescriptionGroupSchema = object({
    standardUnitDescriptions: [
        'standard_unit_descriptions',
        optional(nullable(array(lazy(() => standardUnitDescriptionSchema)))),
    ],
    languageCode: ['language_code', optional(nullable(string()))],
});

const catalogInfoResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    limits: ['limits', optional(lazy(() => catalogInfoResponseLimitsSchema))],
    standardUnitDescriptionGroup: [
        'standard_unit_description_group',
        optional(lazy(() => standardUnitDescriptionGroupSchema)),
    ],
});

const createCatalogImageRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    objectId: ['object_id', optional(string())],
    image: ['image', lazy(() => catalogObjectSchema)],
    isPrimary: ['is_primary', optional(boolean())],
});

const createCatalogImageResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    image: ['image', optional(lazy(() => catalogObjectSchema))],
});

const deleteCatalogObjectResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    deletedObjectIds: ['deleted_object_ids', optional(array(string()))],
    deletedAt: ['deleted_at', optional(string())],
});

const listCatalogResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    cursor: ['cursor', optional(string())],
    objects: ['objects', optional(array(lazy(() => catalogObjectSchema)))],
});

const retrieveCatalogObjectResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    object: ['object', optional(lazy(() => catalogObjectSchema))],
    relatedObjects: [
        'related_objects',
        optional(array(lazy(() => catalogObjectSchema))),
    ],
});

const rangeSchema = object({
    min: ['min', optional(nullable(string()))],
    max: ['max', optional(nullable(string()))],
});

const customAttributeFilterSchema = object({
    customAttributeDefinitionId: [
        'custom_attribute_definition_id',
        optional(nullable(string())),
    ],
    key: ['key', optional(nullable(string()))],
    stringFilter: ['string_filter', optional(nullable(string()))],
    numberFilter: ['number_filter', optional(lazy(() => rangeSchema))],
    selectionUidsFilter: [
        'selection_uids_filter',
        optional(nullable(array(string()))),
    ],
    boolFilter: ['bool_filter', optional(nullable(boolean()))],
});

const searchCatalogItemsRequestSchema = object({
    textFilter: ['text_filter', optional(string())],
    categoryIds: ['category_ids', optional(array(string()))],
    stockLevels: ['stock_levels', optional(array(string()))],
    enabledLocationIds: ['enabled_location_ids', optional(array(string()))],
    cursor: ['cursor', optional(string())],
    limit: ['limit', optional(number())],
    sortOrder: ['sort_order', optional(string())],
    productTypes: ['product_types', optional(array(string()))],
    customAttributeFilters: [
        'custom_attribute_filters',
        optional(array(lazy(() => customAttributeFilterSchema))),
    ],
    archivedState: ['archived_state', optional(string())],
});

const searchCatalogItemsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    items: ['items', optional(array(lazy(() => catalogObjectSchema)))],
    cursor: ['cursor', optional(string())],
    matchedVariationIds: ['matched_variation_ids', optional(array(string()))],
});

const catalogQueryExactSchema = object({
    attributeName: ['attribute_name', string()],
    attributeValue: ['attribute_value', string()],
});

const catalogQueryItemsForItemOptionsSchema = object({ itemOptionIds: ['item_option_ids', optional(nullable(array(string())))] });

const catalogQueryItemsForModifierListSchema = object({ modifierListIds: ['modifier_list_ids', array(string())] });

const catalogQueryItemsForTaxSchema = object({ taxIds: ['tax_ids', array(string())] });

const catalogQueryItemVariationsForItemOptionValuesSchema = object({
    itemOptionValueIds: [
        'item_option_value_ids',
        optional(nullable(array(string()))),
    ],
});

const catalogQueryPrefixSchema = object({
    attributeName: ['attribute_name', string()],
    attributePrefix: ['attribute_prefix', string()],
});

const catalogQueryRangeSchema = object({
    attributeName: ['attribute_name', string()],
    attributeMinValue: ['attribute_min_value', optional(nullable(bigint()))],
    attributeMaxValue: ['attribute_max_value', optional(nullable(bigint()))],
});

const catalogQuerySetSchema = object({
    attributeName: ['attribute_name', string()],
    attributeValues: ['attribute_values', array(string())],
});

const catalogQuerySortedAttributeSchema = object({
    attributeName: ['attribute_name', string()],
    initialAttributeValue: [
        'initial_attribute_value',
        optional(nullable(string())),
    ],
    sortOrder: ['sort_order', optional(string())],
});

const catalogQueryTextSchema = object({
    keywords: ['keywords', array(string())],
});

const catalogQuerySchema = object({
    sortedAttributeQuery: [
        'sorted_attribute_query',
        optional(lazy(() => catalogQuerySortedAttributeSchema)),
    ],
    exactQuery: ['exact_query', optional(lazy(() => catalogQueryExactSchema))],
    setQuery: ['set_query', optional(lazy(() => catalogQuerySetSchema))],
    prefixQuery: ['prefix_query', optional(lazy(() => catalogQueryPrefixSchema))],
    rangeQuery: ['range_query', optional(lazy(() => catalogQueryRangeSchema))],
    textQuery: ['text_query', optional(lazy(() => catalogQueryTextSchema))],
    itemsForTaxQuery: [
        'items_for_tax_query',
        optional(lazy(() => catalogQueryItemsForTaxSchema)),
    ],
    itemsForModifierListQuery: [
        'items_for_modifier_list_query',
        optional(lazy(() => catalogQueryItemsForModifierListSchema)),
    ],
    itemsForItemOptionsQuery: [
        'items_for_item_options_query',
        optional(lazy(() => catalogQueryItemsForItemOptionsSchema)),
    ],
    itemVariationsForItemOptionValuesQuery: [
        'item_variations_for_item_option_values_query',
        optional(lazy(() => catalogQueryItemVariationsForItemOptionValuesSchema)),
    ],
});

const searchCatalogObjectsRequestSchema = object({
    cursor: ['cursor', optional(string())],
    objectTypes: ['object_types', optional(array(string()))],
    includeDeletedObjects: ['include_deleted_objects', optional(boolean())],
    includeRelatedObjects: ['include_related_objects', optional(boolean())],
    beginTime: ['begin_time', optional(string())],
    query: ['query', optional(lazy(() => catalogQuerySchema))],
    limit: ['limit', optional(number())],
    includeCategoryPathToRoot: [
        'include_category_path_to_root',
        optional(boolean()),
    ],
});

const searchCatalogObjectsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    cursor: ['cursor', optional(string())],
    objects: ['objects', optional(array(lazy(() => catalogObjectSchema)))],
    relatedObjects: [
        'related_objects',
        optional(array(lazy(() => catalogObjectSchema))),
    ],
    latestTime: ['latest_time', optional(string())],
});

const updateCatalogImageRequestSchema = object({ idempotencyKey: ['idempotency_key', string()] });

const updateCatalogImageResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    image: ['image', optional(lazy(() => catalogObjectSchema))],
});

const updateItemModifierListsRequestSchema = object({
    itemIds: ['item_ids', array(string())],
    modifierListsToEnable: [
        'modifier_lists_to_enable',
        optional(nullable(array(string()))),
    ],
    modifierListsToDisable: [
        'modifier_lists_to_disable',
        optional(nullable(array(string()))),
    ],
});

const updateItemModifierListsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    updatedAt: ['updated_at', optional(string())],
});

const updateItemTaxesRequestSchema = object({
    itemIds: ['item_ids', array(string())],
    taxesToEnable: ['taxes_to_enable', optional(nullable(array(string())))],
    taxesToDisable: ['taxes_to_disable', optional(nullable(array(string())))],
});

const updateItemTaxesResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    updatedAt: ['updated_at', optional(string())],
});

const upsertCatalogObjectRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    object: ['object', lazy(() => catalogObjectSchema)],
});

const upsertCatalogObjectResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    catalogObject: [
        'catalog_object',
        optional(lazy(() => catalogObjectSchema)),
    ],
    idMappings: [
        'id_mappings',
        optional(array(lazy(() => catalogIdMappingSchema))),
    ],
});

class CatalogApi extends BaseApi {
    /**
     * Deletes a set of [CatalogItem]($m/CatalogItem)s based on the
     * provided list of target IDs and returns a set of successfully deleted IDs in
     * the response. Deletion is a cascading event such that all children of the
     * targeted object are also deleted. For example, deleting a CatalogItem will
     * also delete all of its [CatalogItemVariation]($m/CatalogItemVariation)
     * children.
     *
     * `BatchDeleteCatalogObjects` succeeds even if only a portion of the targeted
     * IDs can be deleted. The response will only include IDs that were
     * actually deleted.
     *
     * To ensure consistency, only one delete request is processed at a time per seller account.
     * While one (batch or non-batch) delete request is being processed, other (batched and non-batched)
     * delete requests are rejected with the `429` error code.
     *
     * @param body         An object containing the fields to POST for the
     *                                                                request.  See the corresponding object definition
     *                                                                for field details.
     * @return Response from the API call
     */
    async batchDeleteCatalogObjects(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/catalog/batch-delete');
        const mapped = req.prepareArgs({
            body: [body, batchDeleteCatalogObjectsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(batchDeleteCatalogObjectsResponseSchema, requestOptions);
    }
    /**
     * Returns a set of objects based on the provided ID.
     * Each [CatalogItem]($m/CatalogItem) returned in the set includes all of its
     * child information including: all of its
     * [CatalogItemVariation]($m/CatalogItemVariation) objects, references to
     * its [CatalogModifierList]($m/CatalogModifierList) objects, and the ids of
     * any [CatalogTax]($m/CatalogTax) objects that apply to it.
     *
     * @param body         An object containing the fields to POST for the
     *                                                                  request.  See the corresponding object definition
     *                                                                  for field details.
     * @return Response from the API call
     */
    async batchRetrieveCatalogObjects(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/catalog/batch-retrieve');
        const mapped = req.prepareArgs({
            body: [body, batchRetrieveCatalogObjectsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(batchRetrieveCatalogObjectsResponseSchema, requestOptions);
    }
    /**
     * Creates or updates up to 10,000 target objects based on the provided
     * list of objects. The target objects are grouped into batches and each batch is
     * inserted/updated in an all-or-nothing manner. If an object within a batch is
     * malformed in some way, or violates a database constraint, the entire batch
     * containing that item will be disregarded. However, other batches in the same
     * request may still succeed. Each batch may contain up to 1,000 objects, and
     * batches will be processed in order as long as the total object count for the
     * request (items, variations, modifier lists, discounts, and taxes) is no more
     * than 10,000.
     *
     * To ensure consistency, only one update request is processed at a time per seller account.
     * While one (batch or non-batch) update request is being processed, other (batched and non-batched)
     * update requests are rejected with the `429` error code.
     *
     * @param body         An object containing the fields to POST for the
     *                                                                request.  See the corresponding object definition
     *                                                                for field details.
     * @return Response from the API call
     */
    async batchUpsertCatalogObjects(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/catalog/batch-upsert');
        const mapped = req.prepareArgs({
            body: [body, batchUpsertCatalogObjectsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(batchUpsertCatalogObjectsResponseSchema, requestOptions);
    }
    /**
     * Uploads an image file to be represented by a [CatalogImage]($m/CatalogImage) object that can be
     * linked to an existing
     * [CatalogObject]($m/CatalogObject) instance. The resulting `CatalogImage` is unattached to any
     * `CatalogObject` if the `object_id`
     * is not specified.
     *
     * This `CreateCatalogImage` endpoint accepts HTTP multipart/form-data requests with a JSON part and an
     * image file part in
     * JPEG, PJPEG, PNG, or GIF format. The maximum file size is 15MB.
     *
     * @param request
     * @param imageFile
     * @return Response from the API call
     */
    async createCatalogImage(request, imageFile, requestOptions) {
        const req = this.createRequest('POST', '/v2/catalog/images');
        const mapped = req.prepareArgs({
            request: [request, optional(createCatalogImageRequestSchema)],
        });
        req.formData({
            request: JSON.stringify(mapped.request),
            image_file: imageFile,
        });
        req.authenticate([{ global: true }]);
        return req.callAsJson(createCatalogImageResponseSchema, requestOptions);
    }
    /**
     * Uploads a new image file to replace the existing one in the specified
     * [CatalogImage]($m/CatalogImage) object.
     *
     * This `UpdateCatalogImage` endpoint accepts HTTP multipart/form-data requests with a JSON part and an
     * image file part in
     * JPEG, PJPEG, PNG, or GIF format. The maximum file size is 15MB.
     *
     * @param imageId    The ID of the `CatalogImage` object to update the
     *                                                       encapsulated image file.
     * @param request
     * @param imageFile
     * @return Response from the API call
     */
    async updateCatalogImage(imageId, request, imageFile, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            imageId: [imageId, string()],
            request: [request, optional(updateCatalogImageRequestSchema)],
        });
        req.formData({
            request: JSON.stringify(mapped.request),
            image_file: imageFile,
        });
        req.appendTemplatePath `/v2/catalog/images/${mapped.imageId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateCatalogImageResponseSchema, requestOptions);
    }
    /**
     * Retrieves information about the Square Catalog API, such as batch size
     * limits that can be used by the `BatchUpsertCatalogObjects` endpoint.
     *
     * @return Response from the API call
     */
    async catalogInfo(requestOptions) {
        const req = this.createRequest('GET', '/v2/catalog/info');
        req.authenticate([{ global: true }]);
        return req.callAsJson(catalogInfoResponseSchema, requestOptions);
    }
    /**
     * Returns a list of all [CatalogObject]($m/CatalogObject)s of the specified types in the catalog.
     *
     * The `types` parameter is specified as a comma-separated list of the
     * [CatalogObjectType]($m/CatalogObjectType) values,
     * for example, "`ITEM`, `ITEM_VARIATION`, `MODIFIER`, `MODIFIER_LIST`, `CATEGORY`, `DISCOUNT`, `TAX`,
     * `IMAGE`".
     *
     * __Important:__ ListCatalog does not return deleted catalog items. To retrieve
     * deleted catalog items, use [SearchCatalogObjects]($e/Catalog/SearchCatalogObjects)
     * and set the `include_deleted_objects` attribute value to `true`.
     *
     * @param cursor          The pagination cursor returned in the previous response. Leave unset for an
     *                                  initial request. The page size is currently set to be 100. See [Pagination](https:
     *                                  //developer.squareup.com/docs/build-basics/common-api-patterns/pagination) for
     *                                  more information.
     * @param types           An optional case-insensitive, comma-separated list of object types to retrieve.
     *                                  The valid values are defined in the [CatalogObjectType](entity:CatalogObjectType)
     *                                  enum, for example, `ITEM`, `ITEM_VARIATION`, `CATEGORY`, `DISCOUNT`, `TAX`,
     *                                  `MODIFIER`, `MODIFIER_LIST`, `IMAGE`, etc.  If this is unspecified, the operation
     *                                  returns objects of all the top level types at the version of the Square API used
     *                                  to make the request. Object types that are nested onto other object types are not
     *                                  included in the defaults.  At the current API version the default object types
     *                                  are: ITEM, CATEGORY, TAX, DISCOUNT, MODIFIER_LIST,  PRICING_RULE, PRODUCT_SET,
     *                                  TIME_PERIOD, MEASUREMENT_UNIT, SUBSCRIPTION_PLAN, ITEM_OPTION,
     *                                  CUSTOM_ATTRIBUTE_DEFINITION, QUICK_AMOUNT_SETTINGS.
     * @param catalogVersion  The specific version of the catalog objects to be included in the response. This
     *                                  allows you to retrieve historical versions of objects. The specified version
     *                                  value is matched against the [CatalogObject]($m/CatalogObject)s' `version`
     *                                  attribute.  If not included, results will be from the current version of the
     *                                  catalog.
     * @return Response from the API call
     */
    async listCatalog(cursor, types, catalogVersion, requestOptions) {
        const req = this.createRequest('GET', '/v2/catalog/list');
        const mapped = req.prepareArgs({
            cursor: [cursor, optional(string())],
            types: [types, optional(string())],
            catalogVersion: [catalogVersion, optional(bigint())],
        });
        req.query('cursor', mapped.cursor);
        req.query('types', mapped.types);
        req.query('catalog_version', mapped.catalogVersion);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listCatalogResponseSchema, requestOptions);
    }
    /**
     * Creates a new or updates the specified [CatalogObject]($m/CatalogObject).
     *
     * To ensure consistency, only one update request is processed at a time per seller account.
     * While one (batch or non-batch) update request is being processed, other (batched and non-batched)
     * update requests are rejected with the `429` error code.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async upsertCatalogObject(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/catalog/object');
        const mapped = req.prepareArgs({
            body: [body, upsertCatalogObjectRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(upsertCatalogObjectResponseSchema, requestOptions);
    }
    /**
     * Deletes a single [CatalogObject]($m/CatalogObject) based on the
     * provided ID and returns the set of successfully deleted IDs in the response.
     * Deletion is a cascading event such that all children of the targeted object
     * are also deleted. For example, deleting a [CatalogItem]($m/CatalogItem)
     * will also delete all of its
     * [CatalogItemVariation]($m/CatalogItemVariation) children.
     *
     * To ensure consistency, only one delete request is processed at a time per seller account.
     * While one (batch or non-batch) delete request is being processed, other (batched and non-batched)
     * delete requests are rejected with the `429` error code.
     *
     * @param objectId  The ID of the catalog object to be deleted. When an object is deleted, other objects
     *                            in the graph that depend on that object will be deleted as well (for example, deleting
     *                            a catalog item will delete its catalog item variations).
     * @return Response from the API call
     */
    async deleteCatalogObject(objectId, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({ objectId: [objectId, string()] });
        req.appendTemplatePath `/v2/catalog/object/${mapped.objectId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteCatalogObjectResponseSchema, requestOptions);
    }
    /**
     * Returns a single [CatalogItem]($m/CatalogItem) as a
     * [CatalogObject]($m/CatalogObject) based on the provided ID. The returned
     * object includes all of the relevant [CatalogItem]($m/CatalogItem)
     * information including: [CatalogItemVariation]($m/CatalogItemVariation)
     * children, references to its
     * [CatalogModifierList]($m/CatalogModifierList) objects, and the ids of
     * any [CatalogTax]($m/CatalogTax) objects that apply to it.
     *
     * @param objectId                      The object ID of any type of catalog objects to be retrieved.
     * @param includeRelatedObjects         If `true`, the response will include additional objects that are
     *                                                 related to the requested objects. Related objects are defined as
     *                                                 any objects referenced by ID by the results in the `objects` field
     *                                                 of the response. These objects are put in the `related_objects`
     *                                                 field. Setting this to `true` is helpful when the objects are
     *                                                 needed for immediate display to a user. This process only goes one
     *                                                 level deep. Objects referenced by the related objects will not be
     *                                                 included. For example,  if the `objects` field of the response
     *                                                 contains a CatalogItem, its associated CatalogCategory objects,
     *                                                 CatalogTax objects, CatalogImage objects and CatalogModifierLists
     *                                                 will be returned in the `related_objects` field of the response.
     *                                                 If the `objects` field of the response contains a
     *                                                 CatalogItemVariation, its parent CatalogItem will be returned in
     *                                                 the `related_objects` field of the response.  Default value:
     *                                                 `false`
     * @param catalogVersion                Requests objects as of a specific version of the catalog. This
     *                                                 allows you to retrieve historical versions of objects. The value
     *                                                 to retrieve a specific version of an object can be found in the
     *                                                 version field of [CatalogObject]($m/CatalogObject)s. If not
     *                                                 included, results will be from the current version of the catalog.
     * @param includeCategoryPathToRoot     Specifies whether or not to include the `path_to_root` list for
     *                                                 each returned category instance. The `path_to_root` list consists
     *                                                 of `CategoryPathToRootNode` objects and specifies the path that
     *                                                 starts with the immediate parent category of the returned category
     *                                                 and ends with its root category. If the returned category is a top-
     *                                                 level category, the `path_to_root` list is empty and is not
     *                                                 returned in the response payload.
     * @return Response from the API call
     */
    async retrieveCatalogObject(objectId, includeRelatedObjects, catalogVersion, includeCategoryPathToRoot, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            objectId: [objectId, string()],
            includeRelatedObjects: [includeRelatedObjects, optional(boolean())],
            catalogVersion: [catalogVersion, optional(bigint())],
            includeCategoryPathToRoot: [
                includeCategoryPathToRoot,
                optional(boolean()),
            ],
        });
        req.query('include_related_objects', mapped.includeRelatedObjects);
        req.query('catalog_version', mapped.catalogVersion);
        req.query('include_category_path_to_root', mapped.includeCategoryPathToRoot);
        req.appendTemplatePath `/v2/catalog/object/${mapped.objectId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveCatalogObjectResponseSchema, requestOptions);
    }
    /**
     * Searches for [CatalogObject]($m/CatalogObject) of any type by matching supported search attribute
     * values,
     * excluding custom attribute values on items or item variations, against one or more of the specified
     * query filters.
     *
     * This (`SearchCatalogObjects`) endpoint differs from the
     * [SearchCatalogItems]($e/Catalog/SearchCatalogItems)
     * endpoint in the following aspects:
     *
     * - `SearchCatalogItems` can only search for items or item variations, whereas `SearchCatalogObjects`
     * can search for any type of catalog objects.
     * - `SearchCatalogItems` supports the custom attribute query filters to return items or item
     * variations that contain custom attribute values, where `SearchCatalogObjects` does not.
     * - `SearchCatalogItems` does not support the `include_deleted_objects` filter to search for deleted
     * items or item variations, whereas `SearchCatalogObjects` does.
     * - The both endpoints have different call conventions, including the query filter formats.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                           See the corresponding object definition for field
     *                                                           details.
     * @return Response from the API call
     */
    async searchCatalogObjects(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/catalog/search');
        const mapped = req.prepareArgs({
            body: [body, searchCatalogObjectsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchCatalogObjectsResponseSchema, requestOptions);
    }
    /**
     * Searches for catalog items or item variations by matching supported search attribute values,
     * including
     * custom attribute values, against one or more of the specified query filters.
     *
     * This (`SearchCatalogItems`) endpoint differs from the
     * [SearchCatalogObjects]($e/Catalog/SearchCatalogObjects)
     * endpoint in the following aspects:
     *
     * - `SearchCatalogItems` can only search for items or item variations, whereas `SearchCatalogObjects`
     * can search for any type of catalog objects.
     * - `SearchCatalogItems` supports the custom attribute query filters to return items or item
     * variations that contain custom attribute values, where `SearchCatalogObjects` does not.
     * - `SearchCatalogItems` does not support the `include_deleted_objects` filter to search for deleted
     * items or item variations, whereas `SearchCatalogObjects` does.
     * - The both endpoints use different call conventions, including the query filter formats.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                         See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async searchCatalogItems(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/catalog/search-catalog-items');
        const mapped = req.prepareArgs({
            body: [body, searchCatalogItemsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchCatalogItemsResponseSchema, requestOptions);
    }
    /**
     * Updates the [CatalogModifierList]($m/CatalogModifierList) objects
     * that apply to the targeted [CatalogItem]($m/CatalogItem) without having
     * to perform an upsert on the entire item.
     *
     * @param body         An object containing the fields to POST for the
     *                                                              request.  See the corresponding object definition for
     *                                                              field details.
     * @return Response from the API call
     */
    async updateItemModifierLists(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/catalog/update-item-modifier-lists');
        const mapped = req.prepareArgs({
            body: [body, updateItemModifierListsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateItemModifierListsResponseSchema, requestOptions);
    }
    /**
     * Updates the [CatalogTax]($m/CatalogTax) objects that apply to the
     * targeted [CatalogItem]($m/CatalogItem) without having to perform an
     * upsert on the entire item.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                      See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async updateItemTaxes(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/catalog/update-item-taxes');
        const mapped = req.prepareArgs({
            body: [body, updateItemTaxesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateItemTaxesResponseSchema, requestOptions);
    }
}

const chargeRequestAdditionalRecipientSchema = object({
    locationId: ['location_id', string()],
    description: ['description', string()],
    amountMoney: ['amount_money', lazy(() => moneySchema)],
});

const fulfillmentRecipientSchema = object({
    customerId: ['customer_id', optional(nullable(string()))],
    displayName: ['display_name', optional(nullable(string()))],
    emailAddress: ['email_address', optional(nullable(string()))],
    phoneNumber: ['phone_number', optional(nullable(string()))],
    address: ['address', optional(lazy(() => addressSchema))],
});

const fulfillmentDeliveryDetailsSchema = object({
    recipient: ['recipient', optional(lazy(() => fulfillmentRecipientSchema))],
    scheduleType: ['schedule_type', optional(string())],
    placedAt: ['placed_at', optional(string())],
    deliverAt: ['deliver_at', optional(nullable(string()))],
    prepTimeDuration: ['prep_time_duration', optional(nullable(string()))],
    deliveryWindowDuration: [
        'delivery_window_duration',
        optional(nullable(string())),
    ],
    note: ['note', optional(nullable(string()))],
    completedAt: ['completed_at', optional(nullable(string()))],
    inProgressAt: ['in_progress_at', optional(string())],
    rejectedAt: ['rejected_at', optional(string())],
    readyAt: ['ready_at', optional(string())],
    deliveredAt: ['delivered_at', optional(string())],
    canceledAt: ['canceled_at', optional(string())],
    cancelReason: ['cancel_reason', optional(nullable(string()))],
    courierPickupAt: ['courier_pickup_at', optional(nullable(string()))],
    courierPickupWindowDuration: [
        'courier_pickup_window_duration',
        optional(nullable(string())),
    ],
    isNoContactDelivery: [
        'is_no_contact_delivery',
        optional(nullable(boolean())),
    ],
    dropoffNotes: ['dropoff_notes', optional(nullable(string()))],
    courierProviderName: [
        'courier_provider_name',
        optional(nullable(string())),
    ],
    courierSupportPhoneNumber: [
        'courier_support_phone_number',
        optional(nullable(string())),
    ],
    squareDeliveryId: ['square_delivery_id', optional(nullable(string()))],
    externalDeliveryId: ['external_delivery_id', optional(nullable(string()))],
    managedDelivery: ['managed_delivery', optional(nullable(boolean()))],
});

const fulfillmentFulfillmentEntrySchema = object({
    uid: ['uid', optional(nullable(string()))],
    lineItemUid: ['line_item_uid', string()],
    quantity: ['quantity', string()],
    metadata: ['metadata', optional(nullable(dict(string())))],
});

const fulfillmentPickupDetailsCurbsidePickupDetailsSchema = object({
    curbsideDetails: ['curbside_details', optional(nullable(string()))],
    buyerArrivedAt: ['buyer_arrived_at', optional(nullable(string()))],
});

const fulfillmentPickupDetailsSchema = object({
    recipient: ['recipient', optional(lazy(() => fulfillmentRecipientSchema))],
    expiresAt: ['expires_at', optional(nullable(string()))],
    autoCompleteDuration: [
        'auto_complete_duration',
        optional(nullable(string())),
    ],
    scheduleType: ['schedule_type', optional(string())],
    pickupAt: ['pickup_at', optional(nullable(string()))],
    pickupWindowDuration: [
        'pickup_window_duration',
        optional(nullable(string())),
    ],
    prepTimeDuration: ['prep_time_duration', optional(nullable(string()))],
    note: ['note', optional(nullable(string()))],
    placedAt: ['placed_at', optional(string())],
    acceptedAt: ['accepted_at', optional(string())],
    rejectedAt: ['rejected_at', optional(string())],
    readyAt: ['ready_at', optional(string())],
    expiredAt: ['expired_at', optional(string())],
    pickedUpAt: ['picked_up_at', optional(string())],
    canceledAt: ['canceled_at', optional(string())],
    cancelReason: ['cancel_reason', optional(nullable(string()))],
    isCurbsidePickup: ['is_curbside_pickup', optional(nullable(boolean()))],
    curbsidePickupDetails: [
        'curbside_pickup_details',
        optional(lazy(() => fulfillmentPickupDetailsCurbsidePickupDetailsSchema)),
    ],
});

const fulfillmentShipmentDetailsSchema = object({
    recipient: ['recipient', optional(lazy(() => fulfillmentRecipientSchema))],
    carrier: ['carrier', optional(nullable(string()))],
    shippingNote: ['shipping_note', optional(nullable(string()))],
    shippingType: ['shipping_type', optional(nullable(string()))],
    trackingNumber: ['tracking_number', optional(nullable(string()))],
    trackingUrl: ['tracking_url', optional(nullable(string()))],
    placedAt: ['placed_at', optional(string())],
    inProgressAt: ['in_progress_at', optional(string())],
    packagedAt: ['packaged_at', optional(string())],
    expectedShippedAt: ['expected_shipped_at', optional(nullable(string()))],
    shippedAt: ['shipped_at', optional(string())],
    canceledAt: ['canceled_at', optional(nullable(string()))],
    cancelReason: ['cancel_reason', optional(nullable(string()))],
    failedAt: ['failed_at', optional(string())],
    failureReason: ['failure_reason', optional(nullable(string()))],
});

const fulfillmentSchema = object({
    uid: ['uid', optional(nullable(string()))],
    type: ['type', optional(string())],
    state: ['state', optional(string())],
    lineItemApplication: ['line_item_application', optional(string())],
    entries: [
        'entries',
        optional(array(lazy(() => fulfillmentFulfillmentEntrySchema))),
    ],
    metadata: ['metadata', optional(nullable(dict(string())))],
    pickupDetails: [
        'pickup_details',
        optional(lazy(() => fulfillmentPickupDetailsSchema)),
    ],
    shipmentDetails: [
        'shipment_details',
        optional(lazy(() => fulfillmentShipmentDetailsSchema)),
    ],
    deliveryDetails: [
        'delivery_details',
        optional(lazy(() => fulfillmentDeliveryDetailsSchema)),
    ],
});

const orderLineItemAppliedDiscountSchema = object({
    uid: ['uid', optional(nullable(string()))],
    discountUid: ['discount_uid', string()],
    appliedMoney: ['applied_money', optional(lazy(() => moneySchema))],
});

const orderLineItemAppliedServiceChargeSchema = object({
    uid: ['uid', optional(nullable(string()))],
    serviceChargeUid: ['service_charge_uid', string()],
    appliedMoney: ['applied_money', optional(lazy(() => moneySchema))],
});

const orderLineItemAppliedTaxSchema = object({
    uid: ['uid', optional(nullable(string()))],
    taxUid: ['tax_uid', string()],
    appliedMoney: ['applied_money', optional(lazy(() => moneySchema))],
});

const orderLineItemModifierSchema = object({
    uid: ['uid', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
    name: ['name', optional(nullable(string()))],
    quantity: ['quantity', optional(nullable(string()))],
    basePriceMoney: ['base_price_money', optional(lazy(() => moneySchema))],
    totalPriceMoney: ['total_price_money', optional(lazy(() => moneySchema))],
    metadata: ['metadata', optional(nullable(dict(string())))],
});

const orderLineItemPricingBlocklistsBlockedDiscountSchema = object({
    uid: ['uid', optional(nullable(string()))],
    discountUid: ['discount_uid', optional(nullable(string()))],
    discountCatalogObjectId: [
        'discount_catalog_object_id',
        optional(nullable(string())),
    ],
});

const orderLineItemPricingBlocklistsBlockedTaxSchema = object({
    uid: ['uid', optional(nullable(string()))],
    taxUid: ['tax_uid', optional(nullable(string()))],
    taxCatalogObjectId: ['tax_catalog_object_id', optional(nullable(string()))],
});

const orderLineItemPricingBlocklistsSchema = object({
    blockedDiscounts: [
        'blocked_discounts',
        optional(nullable(array(lazy(() => orderLineItemPricingBlocklistsBlockedDiscountSchema)))),
    ],
    blockedTaxes: [
        'blocked_taxes',
        optional(nullable(array(lazy(() => orderLineItemPricingBlocklistsBlockedTaxSchema)))),
    ],
});

const orderQuantityUnitSchema = object({
    measurementUnit: [
        'measurement_unit',
        optional(lazy(() => measurementUnitSchema)),
    ],
    precision: ['precision', optional(nullable(number()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
});

const orderLineItemSchema = object({
    uid: ['uid', optional(nullable(string()))],
    name: ['name', optional(nullable(string()))],
    quantity: ['quantity', string()],
    quantityUnit: [
        'quantity_unit',
        optional(lazy(() => orderQuantityUnitSchema)),
    ],
    note: ['note', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
    variationName: ['variation_name', optional(nullable(string()))],
    itemType: ['item_type', optional(string())],
    metadata: ['metadata', optional(nullable(dict(string())))],
    modifiers: [
        'modifiers',
        optional(nullable(array(lazy(() => orderLineItemModifierSchema)))),
    ],
    appliedTaxes: [
        'applied_taxes',
        optional(nullable(array(lazy(() => orderLineItemAppliedTaxSchema)))),
    ],
    appliedDiscounts: [
        'applied_discounts',
        optional(nullable(array(lazy(() => orderLineItemAppliedDiscountSchema)))),
    ],
    appliedServiceCharges: [
        'applied_service_charges',
        optional(nullable(array(lazy(() => orderLineItemAppliedServiceChargeSchema)))),
    ],
    basePriceMoney: ['base_price_money', optional(lazy(() => moneySchema))],
    variationTotalPriceMoney: [
        'variation_total_price_money',
        optional(lazy(() => moneySchema)),
    ],
    grossSalesMoney: ['gross_sales_money', optional(lazy(() => moneySchema))],
    totalTaxMoney: ['total_tax_money', optional(lazy(() => moneySchema))],
    totalDiscountMoney: [
        'total_discount_money',
        optional(lazy(() => moneySchema)),
    ],
    totalMoney: ['total_money', optional(lazy(() => moneySchema))],
    pricingBlocklists: [
        'pricing_blocklists',
        optional(lazy(() => orderLineItemPricingBlocklistsSchema)),
    ],
    totalServiceChargeMoney: [
        'total_service_charge_money',
        optional(lazy(() => moneySchema)),
    ],
});

const orderLineItemDiscountSchema = object({
    uid: ['uid', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
    name: ['name', optional(nullable(string()))],
    type: ['type', optional(string())],
    percentage: ['percentage', optional(nullable(string()))],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    appliedMoney: ['applied_money', optional(lazy(() => moneySchema))],
    metadata: ['metadata', optional(nullable(dict(string())))],
    scope: ['scope', optional(string())],
    rewardIds: ['reward_ids', optional(array(string()))],
    pricingRuleId: ['pricing_rule_id', optional(string())],
});

const orderLineItemTaxSchema = object({
    uid: ['uid', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
    name: ['name', optional(nullable(string()))],
    type: ['type', optional(string())],
    percentage: ['percentage', optional(nullable(string()))],
    metadata: ['metadata', optional(nullable(dict(string())))],
    appliedMoney: ['applied_money', optional(lazy(() => moneySchema))],
    scope: ['scope', optional(string())],
    autoApplied: ['auto_applied', optional(boolean())],
});

const orderMoneyAmountsSchema = object({
    totalMoney: ['total_money', optional(lazy(() => moneySchema))],
    taxMoney: ['tax_money', optional(lazy(() => moneySchema))],
    discountMoney: ['discount_money', optional(lazy(() => moneySchema))],
    tipMoney: ['tip_money', optional(lazy(() => moneySchema))],
    serviceChargeMoney: [
        'service_charge_money',
        optional(lazy(() => moneySchema)),
    ],
});

const orderPricingOptionsSchema = object({
    autoApplyDiscounts: ['auto_apply_discounts', optional(nullable(boolean()))],
    autoApplyTaxes: ['auto_apply_taxes', optional(nullable(boolean()))],
});

const orderReturnDiscountSchema = object({
    uid: ['uid', optional(nullable(string()))],
    sourceDiscountUid: ['source_discount_uid', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
    name: ['name', optional(nullable(string()))],
    type: ['type', optional(string())],
    percentage: ['percentage', optional(nullable(string()))],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    appliedMoney: ['applied_money', optional(lazy(() => moneySchema))],
    scope: ['scope', optional(string())],
});

const orderReturnLineItemModifierSchema = object({
    uid: ['uid', optional(nullable(string()))],
    sourceModifierUid: ['source_modifier_uid', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
    name: ['name', optional(nullable(string()))],
    basePriceMoney: ['base_price_money', optional(lazy(() => moneySchema))],
    totalPriceMoney: ['total_price_money', optional(lazy(() => moneySchema))],
    quantity: ['quantity', optional(nullable(string()))],
});

const orderReturnLineItemSchema = object({
    uid: ['uid', optional(nullable(string()))],
    sourceLineItemUid: ['source_line_item_uid', optional(nullable(string()))],
    name: ['name', optional(nullable(string()))],
    quantity: ['quantity', string()],
    quantityUnit: [
        'quantity_unit',
        optional(lazy(() => orderQuantityUnitSchema)),
    ],
    note: ['note', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
    variationName: ['variation_name', optional(nullable(string()))],
    itemType: ['item_type', optional(string())],
    returnModifiers: [
        'return_modifiers',
        optional(nullable(array(lazy(() => orderReturnLineItemModifierSchema)))),
    ],
    appliedTaxes: [
        'applied_taxes',
        optional(nullable(array(lazy(() => orderLineItemAppliedTaxSchema)))),
    ],
    appliedDiscounts: [
        'applied_discounts',
        optional(nullable(array(lazy(() => orderLineItemAppliedDiscountSchema)))),
    ],
    basePriceMoney: ['base_price_money', optional(lazy(() => moneySchema))],
    variationTotalPriceMoney: [
        'variation_total_price_money',
        optional(lazy(() => moneySchema)),
    ],
    grossReturnMoney: ['gross_return_money', optional(lazy(() => moneySchema))],
    totalTaxMoney: ['total_tax_money', optional(lazy(() => moneySchema))],
    totalDiscountMoney: [
        'total_discount_money',
        optional(lazy(() => moneySchema)),
    ],
    totalMoney: ['total_money', optional(lazy(() => moneySchema))],
    appliedServiceCharges: [
        'applied_service_charges',
        optional(nullable(array(lazy(() => orderLineItemAppliedServiceChargeSchema)))),
    ],
    totalServiceChargeMoney: [
        'total_service_charge_money',
        optional(lazy(() => moneySchema)),
    ],
});

const orderReturnServiceChargeSchema = object({
    uid: ['uid', optional(nullable(string()))],
    sourceServiceChargeUid: [
        'source_service_charge_uid',
        optional(nullable(string())),
    ],
    name: ['name', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
    percentage: ['percentage', optional(nullable(string()))],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    appliedMoney: ['applied_money', optional(lazy(() => moneySchema))],
    totalMoney: ['total_money', optional(lazy(() => moneySchema))],
    totalTaxMoney: ['total_tax_money', optional(lazy(() => moneySchema))],
    calculationPhase: ['calculation_phase', optional(string())],
    taxable: ['taxable', optional(nullable(boolean()))],
    appliedTaxes: [
        'applied_taxes',
        optional(nullable(array(lazy(() => orderLineItemAppliedTaxSchema)))),
    ],
    treatmentType: ['treatment_type', optional(string())],
    scope: ['scope', optional(string())],
});

const orderReturnTaxSchema = object({
    uid: ['uid', optional(nullable(string()))],
    sourceTaxUid: ['source_tax_uid', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
    name: ['name', optional(nullable(string()))],
    type: ['type', optional(string())],
    percentage: ['percentage', optional(nullable(string()))],
    appliedMoney: ['applied_money', optional(lazy(() => moneySchema))],
    scope: ['scope', optional(string())],
});

const orderReturnTipSchema = object({
    uid: ['uid', optional(nullable(string()))],
    appliedMoney: ['applied_money', optional(lazy(() => moneySchema))],
    sourceTenderUid: ['source_tender_uid', optional(nullable(string()))],
    sourceTenderId: ['source_tender_id', optional(nullable(string()))],
});

const orderRoundingAdjustmentSchema = object({
    uid: ['uid', optional(nullable(string()))],
    name: ['name', optional(nullable(string()))],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
});

const orderReturnSchema = object({
    uid: ['uid', optional(nullable(string()))],
    sourceOrderId: ['source_order_id', optional(nullable(string()))],
    returnLineItems: [
        'return_line_items',
        optional(nullable(array(lazy(() => orderReturnLineItemSchema)))),
    ],
    returnServiceCharges: [
        'return_service_charges',
        optional(nullable(array(lazy(() => orderReturnServiceChargeSchema)))),
    ],
    returnTaxes: [
        'return_taxes',
        optional(array(lazy(() => orderReturnTaxSchema))),
    ],
    returnDiscounts: [
        'return_discounts',
        optional(array(lazy(() => orderReturnDiscountSchema))),
    ],
    returnTips: [
        'return_tips',
        optional(nullable(array(lazy(() => orderReturnTipSchema)))),
    ],
    roundingAdjustment: [
        'rounding_adjustment',
        optional(lazy(() => orderRoundingAdjustmentSchema)),
    ],
    returnAmounts: [
        'return_amounts',
        optional(lazy(() => orderMoneyAmountsSchema)),
    ],
});

const orderRewardSchema = object({
    id: ['id', string()],
    rewardTierId: ['reward_tier_id', string()],
});

const orderServiceChargeSchema = object({
    uid: ['uid', optional(nullable(string()))],
    name: ['name', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
    percentage: ['percentage', optional(nullable(string()))],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    appliedMoney: ['applied_money', optional(lazy(() => moneySchema))],
    totalMoney: ['total_money', optional(lazy(() => moneySchema))],
    totalTaxMoney: ['total_tax_money', optional(lazy(() => moneySchema))],
    calculationPhase: ['calculation_phase', optional(string())],
    taxable: ['taxable', optional(nullable(boolean()))],
    appliedTaxes: [
        'applied_taxes',
        optional(nullable(array(lazy(() => orderLineItemAppliedTaxSchema)))),
    ],
    metadata: ['metadata', optional(nullable(dict(string())))],
    type: ['type', optional(string())],
    treatmentType: ['treatment_type', optional(string())],
    scope: ['scope', optional(string())],
});

const orderSourceSchema = object({
    name: ['name', optional(nullable(string()))],
});

const additionalRecipientSchema = object({
    locationId: ['location_id', string()],
    description: ['description', optional(nullable(string()))],
    amountMoney: ['amount_money', lazy(() => moneySchema)],
    receivableId: ['receivable_id', optional(nullable(string()))],
});

const refundSchema = object({
    id: ['id', string()],
    locationId: ['location_id', string()],
    transactionId: ['transaction_id', optional(nullable(string()))],
    tenderId: ['tender_id', string()],
    createdAt: ['created_at', optional(string())],
    reason: ['reason', string()],
    amountMoney: ['amount_money', lazy(() => moneySchema)],
    status: ['status', string()],
    processingFeeMoney: [
        'processing_fee_money',
        optional(lazy(() => moneySchema)),
    ],
    additionalRecipients: [
        'additional_recipients',
        optional(nullable(array(lazy(() => additionalRecipientSchema)))),
    ],
});

const tenderBankAccountDetailsSchema = object({ status: ['status', optional(string())] });

const tenderBuyNowPayLaterDetailsSchema = object({
    buyNowPayLaterBrand: ['buy_now_pay_later_brand', optional(string())],
    status: ['status', optional(string())],
});

const tenderCardDetailsSchema = object({
    status: ['status', optional(string())],
    card: ['card', optional(lazy(() => cardSchema))],
    entryMethod: ['entry_method', optional(string())],
});

const tenderCashDetailsSchema = object({
    buyerTenderedMoney: [
        'buyer_tendered_money',
        optional(lazy(() => moneySchema)),
    ],
    changeBackMoney: ['change_back_money', optional(lazy(() => moneySchema))],
});

const tenderSquareAccountDetailsSchema = object({ status: ['status', optional(string())] });

const tenderSchema = object({
    id: ['id', optional(string())],
    locationId: ['location_id', optional(nullable(string()))],
    transactionId: ['transaction_id', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
    note: ['note', optional(nullable(string()))],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    tipMoney: ['tip_money', optional(lazy(() => moneySchema))],
    processingFeeMoney: [
        'processing_fee_money',
        optional(lazy(() => moneySchema)),
    ],
    customerId: ['customer_id', optional(nullable(string()))],
    type: ['type', string()],
    cardDetails: ['card_details', optional(lazy(() => tenderCardDetailsSchema))],
    cashDetails: ['cash_details', optional(lazy(() => tenderCashDetailsSchema))],
    bankAccountDetails: [
        'bank_account_details',
        optional(lazy(() => tenderBankAccountDetailsSchema)),
    ],
    buyNowPayLaterDetails: [
        'buy_now_pay_later_details',
        optional(lazy(() => tenderBuyNowPayLaterDetailsSchema)),
    ],
    squareAccountDetails: [
        'square_account_details',
        optional(lazy(() => tenderSquareAccountDetailsSchema)),
    ],
    additionalRecipients: [
        'additional_recipients',
        optional(nullable(array(lazy(() => additionalRecipientSchema)))),
    ],
    paymentId: ['payment_id', optional(nullable(string()))],
});

const orderSchema = object({
    id: ['id', optional(string())],
    locationId: ['location_id', string()],
    referenceId: ['reference_id', optional(nullable(string()))],
    source: ['source', optional(lazy(() => orderSourceSchema))],
    customerId: ['customer_id', optional(nullable(string()))],
    lineItems: [
        'line_items',
        optional(nullable(array(lazy(() => orderLineItemSchema)))),
    ],
    taxes: [
        'taxes',
        optional(nullable(array(lazy(() => orderLineItemTaxSchema)))),
    ],
    discounts: [
        'discounts',
        optional(nullable(array(lazy(() => orderLineItemDiscountSchema)))),
    ],
    serviceCharges: [
        'service_charges',
        optional(nullable(array(lazy(() => orderServiceChargeSchema)))),
    ],
    fulfillments: [
        'fulfillments',
        optional(nullable(array(lazy(() => fulfillmentSchema)))),
    ],
    returns: ['returns', optional(array(lazy(() => orderReturnSchema)))],
    returnAmounts: [
        'return_amounts',
        optional(lazy(() => orderMoneyAmountsSchema)),
    ],
    netAmounts: ['net_amounts', optional(lazy(() => orderMoneyAmountsSchema))],
    roundingAdjustment: [
        'rounding_adjustment',
        optional(lazy(() => orderRoundingAdjustmentSchema)),
    ],
    tenders: ['tenders', optional(array(lazy(() => tenderSchema)))],
    refunds: ['refunds', optional(array(lazy(() => refundSchema)))],
    metadata: ['metadata', optional(nullable(dict(string())))],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    closedAt: ['closed_at', optional(string())],
    state: ['state', optional(string())],
    version: ['version', optional(number())],
    totalMoney: ['total_money', optional(lazy(() => moneySchema))],
    totalTaxMoney: ['total_tax_money', optional(lazy(() => moneySchema))],
    totalDiscountMoney: [
        'total_discount_money',
        optional(lazy(() => moneySchema)),
    ],
    totalTipMoney: ['total_tip_money', optional(lazy(() => moneySchema))],
    totalServiceChargeMoney: [
        'total_service_charge_money',
        optional(lazy(() => moneySchema)),
    ],
    ticketName: ['ticket_name', optional(nullable(string()))],
    pricingOptions: [
        'pricing_options',
        optional(lazy(() => orderPricingOptionsSchema)),
    ],
    rewards: ['rewards', optional(array(lazy(() => orderRewardSchema)))],
    netAmountDueMoney: [
        'net_amount_due_money',
        optional(lazy(() => moneySchema)),
    ],
});

const createOrderRequestSchema = object({
    order: ['order', optional(lazy(() => orderSchema))],
    idempotencyKey: ['idempotency_key', optional(string())],
});

const createCheckoutRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    order: ['order', lazy(() => createOrderRequestSchema)],
    askForShippingAddress: ['ask_for_shipping_address', optional(boolean())],
    merchantSupportEmail: ['merchant_support_email', optional(string())],
    prePopulateBuyerEmail: ['pre_populate_buyer_email', optional(string())],
    prePopulateShippingAddress: [
        'pre_populate_shipping_address',
        optional(lazy(() => addressSchema)),
    ],
    redirectUrl: ['redirect_url', optional(string())],
    additionalRecipients: [
        'additional_recipients',
        optional(array(lazy(() => chargeRequestAdditionalRecipientSchema))),
    ],
    note: ['note', optional(string())],
});

const checkoutSchema = object({
    id: ['id', optional(string())],
    checkoutPageUrl: ['checkout_page_url', optional(nullable(string()))],
    askForShippingAddress: [
        'ask_for_shipping_address',
        optional(nullable(boolean())),
    ],
    merchantSupportEmail: [
        'merchant_support_email',
        optional(nullable(string())),
    ],
    prePopulateBuyerEmail: [
        'pre_populate_buyer_email',
        optional(nullable(string())),
    ],
    prePopulateShippingAddress: [
        'pre_populate_shipping_address',
        optional(lazy(() => addressSchema)),
    ],
    redirectUrl: ['redirect_url', optional(nullable(string()))],
    order: ['order', optional(lazy(() => orderSchema))],
    createdAt: ['created_at', optional(string())],
    additionalRecipients: [
        'additional_recipients',
        optional(nullable(array(lazy(() => additionalRecipientSchema)))),
    ],
});

const createCheckoutResponseSchema = object({
    checkout: ['checkout', optional(lazy(() => checkoutSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const acceptedPaymentMethodsSchema = object({
    applePay: ['apple_pay', optional(nullable(boolean()))],
    googlePay: ['google_pay', optional(nullable(boolean()))],
    cashAppPay: ['cash_app_pay', optional(nullable(boolean()))],
    afterpayClearpay: ['afterpay_clearpay', optional(nullable(boolean()))],
});

const customFieldSchema = object({
    title: ['title', string()],
});

const shippingFeeSchema = object({
    name: ['name', optional(nullable(string()))],
    charge: ['charge', lazy(() => moneySchema)],
});

const checkoutOptionsSchema = object({
    allowTipping: ['allow_tipping', optional(nullable(boolean()))],
    customFields: [
        'custom_fields',
        optional(nullable(array(lazy(() => customFieldSchema)))),
    ],
    subscriptionPlanId: ['subscription_plan_id', optional(nullable(string()))],
    redirectUrl: ['redirect_url', optional(nullable(string()))],
    merchantSupportEmail: [
        'merchant_support_email',
        optional(nullable(string())),
    ],
    askForShippingAddress: [
        'ask_for_shipping_address',
        optional(nullable(boolean())),
    ],
    acceptedPaymentMethods: [
        'accepted_payment_methods',
        optional(lazy(() => acceptedPaymentMethodsSchema)),
    ],
    appFeeMoney: ['app_fee_money', optional(lazy(() => moneySchema))],
    shippingFee: ['shipping_fee', optional(lazy(() => shippingFeeSchema))],
    enableCoupon: ['enable_coupon', optional(nullable(boolean()))],
    enableLoyalty: ['enable_loyalty', optional(nullable(boolean()))],
});

const prePopulatedDataSchema = object({
    buyerEmail: ['buyer_email', optional(nullable(string()))],
    buyerPhoneNumber: ['buyer_phone_number', optional(nullable(string()))],
    buyerAddress: ['buyer_address', optional(lazy(() => addressSchema))],
});

const quickPaySchema = object({
    name: ['name', string()],
    priceMoney: ['price_money', lazy(() => moneySchema)],
    locationId: ['location_id', string()],
});

const createPaymentLinkRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(string())],
    description: ['description', optional(string())],
    quickPay: ['quick_pay', optional(lazy(() => quickPaySchema))],
    order: ['order', optional(lazy(() => orderSchema))],
    checkoutOptions: [
        'checkout_options',
        optional(lazy(() => checkoutOptionsSchema)),
    ],
    prePopulatedData: [
        'pre_populated_data',
        optional(lazy(() => prePopulatedDataSchema)),
    ],
    paymentNote: ['payment_note', optional(string())],
});

const paymentLinkSchema = object({
    id: ['id', optional(string())],
    version: ['version', number()],
    description: ['description', optional(nullable(string()))],
    orderId: ['order_id', optional(string())],
    checkoutOptions: [
        'checkout_options',
        optional(lazy(() => checkoutOptionsSchema)),
    ],
    prePopulatedData: [
        'pre_populated_data',
        optional(lazy(() => prePopulatedDataSchema)),
    ],
    url: ['url', optional(string())],
    longUrl: ['long_url', optional(string())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    paymentNote: ['payment_note', optional(nullable(string()))],
});

const paymentLinkRelatedResourcesSchema = object({
    orders: ['orders', optional(nullable(array(lazy(() => orderSchema))))],
    subscriptionPlans: [
        'subscription_plans',
        optional(nullable(array(lazy(() => catalogObjectSchema)))),
    ],
});

const createPaymentLinkResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    paymentLink: ['payment_link', optional(lazy(() => paymentLinkSchema))],
    relatedResources: [
        'related_resources',
        optional(lazy(() => paymentLinkRelatedResourcesSchema)),
    ],
});

const deletePaymentLinkResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    id: ['id', optional(string())],
    cancelledOrderId: ['cancelled_order_id', optional(string())],
});

const listPaymentLinksResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    paymentLinks: [
        'payment_links',
        optional(array(lazy(() => paymentLinkSchema))),
    ],
    cursor: ['cursor', optional(string())],
});

const checkoutLocationSettingsBrandingSchema = object({
    headerType: ['header_type', optional(string())],
    buttonColor: ['button_color', optional(nullable(string()))],
    buttonShape: ['button_shape', optional(string())],
});

const checkoutLocationSettingsCouponsSchema = object({ enabled: ['enabled', optional(nullable(boolean()))] });

const checkoutLocationSettingsPolicySchema = object({
    uid: ['uid', optional(nullable(string()))],
    title: ['title', optional(nullable(string()))],
    description: ['description', optional(nullable(string()))],
});

const checkoutLocationSettingsTippingSchema = object({
    percentages: ['percentages', optional(nullable(array(number())))],
    smartTippingEnabled: [
        'smart_tipping_enabled',
        optional(nullable(boolean())),
    ],
    defaultPercent: ['default_percent', optional(nullable(number()))],
    smartTips: [
        'smart_tips',
        optional(nullable(array(lazy(() => moneySchema)))),
    ],
    defaultSmartTip: ['default_smart_tip', optional(lazy(() => moneySchema))],
});

const checkoutLocationSettingsSchema = object({
    locationId: ['location_id', optional(nullable(string()))],
    customerNotesEnabled: [
        'customer_notes_enabled',
        optional(nullable(boolean())),
    ],
    policies: [
        'policies',
        optional(nullable(array(lazy(() => checkoutLocationSettingsPolicySchema)))),
    ],
    branding: [
        'branding',
        optional(lazy(() => checkoutLocationSettingsBrandingSchema)),
    ],
    tipping: [
        'tipping',
        optional(lazy(() => checkoutLocationSettingsTippingSchema)),
    ],
    coupons: [
        'coupons',
        optional(lazy(() => checkoutLocationSettingsCouponsSchema)),
    ],
    updatedAt: ['updated_at', optional(string())],
});

const retrieveLocationSettingsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    locationSettings: [
        'location_settings',
        optional(lazy(() => checkoutLocationSettingsSchema)),
    ],
});

const checkoutMerchantSettingsPaymentMethodsAfterpayClearpayEligibilityRangeSchema = object({
    min: ['min', lazy(() => moneySchema)],
    max: ['max', lazy(() => moneySchema)],
});

const checkoutMerchantSettingsPaymentMethodsAfterpayClearpaySchema = object({
    orderEligibilityRange: [
        'order_eligibility_range',
        optional(lazy(() => checkoutMerchantSettingsPaymentMethodsAfterpayClearpayEligibilityRangeSchema)),
    ],
    itemEligibilityRange: [
        'item_eligibility_range',
        optional(lazy(() => checkoutMerchantSettingsPaymentMethodsAfterpayClearpayEligibilityRangeSchema)),
    ],
    enabled: ['enabled', optional(boolean())],
});

const checkoutMerchantSettingsPaymentMethodsPaymentMethodSchema = object({ enabled: ['enabled', optional(nullable(boolean()))] });

const checkoutMerchantSettingsPaymentMethodsSchema = object({
    applePay: [
        'apple_pay',
        optional(lazy(() => checkoutMerchantSettingsPaymentMethodsPaymentMethodSchema)),
    ],
    googlePay: [
        'google_pay',
        optional(lazy(() => checkoutMerchantSettingsPaymentMethodsPaymentMethodSchema)),
    ],
    cashApp: [
        'cash_app',
        optional(lazy(() => checkoutMerchantSettingsPaymentMethodsPaymentMethodSchema)),
    ],
    afterpayClearpay: [
        'afterpay_clearpay',
        optional(lazy(() => checkoutMerchantSettingsPaymentMethodsAfterpayClearpaySchema)),
    ],
});

const checkoutMerchantSettingsSchema = object({
    paymentMethods: [
        'payment_methods',
        optional(lazy(() => checkoutMerchantSettingsPaymentMethodsSchema)),
    ],
    updatedAt: ['updated_at', optional(string())],
});

const retrieveMerchantSettingsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    merchantSettings: [
        'merchant_settings',
        optional(lazy(() => checkoutMerchantSettingsSchema)),
    ],
});

const retrievePaymentLinkResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    paymentLink: ['payment_link', optional(lazy(() => paymentLinkSchema))],
});

const updateLocationSettingsRequestSchema = object({
    locationSettings: [
        'location_settings',
        lazy(() => checkoutLocationSettingsSchema),
    ],
});

const updateLocationSettingsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    locationSettings: [
        'location_settings',
        optional(lazy(() => checkoutLocationSettingsSchema)),
    ],
});

const updateMerchantSettingsRequestSchema = object({
    merchantSettings: [
        'merchant_settings',
        lazy(() => checkoutMerchantSettingsSchema),
    ],
});

const updateMerchantSettingsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    merchantSettings: [
        'merchant_settings',
        optional(lazy(() => checkoutMerchantSettingsSchema)),
    ],
});

const updatePaymentLinkRequestSchema = object({ paymentLink: ['payment_link', lazy(() => paymentLinkSchema)] });

const updatePaymentLinkResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    paymentLink: ['payment_link', optional(lazy(() => paymentLinkSchema))],
});

class CheckoutApi extends BaseApi {
    /**
     * Links a `checkoutId` to a `checkout_page_url` that customers are
     * directed to in order to provide their payment information using a
     * payment processing workflow hosted on connect.squareup.com.
     *
     *
     * NOTE: The Checkout API has been updated with new features.
     * For more information, see [Checkout API highlights](https://developer.squareup.com/docs/checkout-
     * api#checkout-api-highlights).
     *
     * @param locationId   The ID of the business location to associate the checkout
     *                                                     with.
     * @param body         An object containing the fields to POST for the request.  See
     *                                                     the corresponding object definition for field details.
     * @return Response from the API call
     * @deprecated
     */
    async createCheckout(locationId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            body: [body, createCheckoutRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/locations/${mapped.locationId}/checkouts`;
        req.deprecated('CheckoutApi.createCheckout');
        req.authenticate([{ global: true }]);
        return req.callAsJson(createCheckoutResponseSchema, requestOptions);
    }
    /**
     * Retrieves the location-level settings for a Square-hosted checkout page.
     *
     * @param locationId  The ID of the location for which to retrieve settings.
     * @return Response from the API call
     */
    async retrieveLocationSettings(locationId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ locationId: [locationId, string()] });
        req.appendTemplatePath `/v2/online-checkout/location-settings/${mapped.locationId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveLocationSettingsResponseSchema, requestOptions);
    }
    /**
     * Updates the location-level settings for a Square-hosted checkout page.
     *
     * @param locationId   The ID of the location for which to retrieve settings.
     * @param body         An object containing the fields to POST for the
     *                                                             request.  See the corresponding object definition for
     *                                                             field details.
     * @return Response from the API call
     */
    async updateLocationSettings(locationId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            body: [body, updateLocationSettingsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/online-checkout/location-settings/${mapped.locationId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateLocationSettingsResponseSchema, requestOptions);
    }
    /**
     * Retrieves the merchant-level settings for a Square-hosted checkout page.
     *
     * @return Response from the API call
     */
    async retrieveMerchantSettings(requestOptions) {
        const req = this.createRequest('GET', '/v2/online-checkout/merchant-settings');
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveMerchantSettingsResponseSchema, requestOptions);
    }
    /**
     * Updates the merchant-level settings for a Square-hosted checkout page.
     *
     * @param body         An object containing the fields to POST for the
     *                                                             request.  See the corresponding object definition for
     *                                                             field details.
     * @return Response from the API call
     */
    async updateMerchantSettings(body, requestOptions) {
        const req = this.createRequest('PUT', '/v2/online-checkout/merchant-settings');
        const mapped = req.prepareArgs({
            body: [body, updateMerchantSettingsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateMerchantSettingsResponseSchema, requestOptions);
    }
    /**
     * Lists all payment links.
     *
     * @param cursor A pagination cursor returned by a previous call to this endpoint. Provide this cursor to
     *                         retrieve the next set of results for the original query. If a cursor is not provided, the
     *                         endpoint returns the first page of the results. For more  information, see
     *                         [Pagination](https://developer.squareup.com/docs/build-basics/common-api-
     *                         patterns/pagination).
     * @param limit  A limit on the number of results to return per page. The limit is advisory and the
     *                         implementation might return more or less results. If the supplied limit is negative, zero,
     *                         or greater than the maximum limit of 1000, it is ignored.  Default value: `100`
     * @return Response from the API call
     */
    async listPaymentLinks(cursor, limit, requestOptions) {
        const req = this.createRequest('GET', '/v2/online-checkout/payment-links');
        const mapped = req.prepareArgs({
            cursor: [cursor, optional(string())],
            limit: [limit, optional(number())],
        });
        req.query('cursor', mapped.cursor);
        req.query('limit', mapped.limit);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listPaymentLinksResponseSchema, requestOptions);
    }
    /**
     * Creates a Square-hosted checkout page. Applications can share the resulting payment link with their
     * buyer to pay for goods and services.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                        See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createPaymentLink(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/online-checkout/payment-links');
        const mapped = req.prepareArgs({
            body: [body, createPaymentLinkRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createPaymentLinkResponseSchema, requestOptions);
    }
    /**
     * Deletes a payment link.
     *
     * @param id The ID of the payment link to delete.
     * @return Response from the API call
     */
    async deletePaymentLink(id, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({ id: [id, string()] });
        req.appendTemplatePath `/v2/online-checkout/payment-links/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deletePaymentLinkResponseSchema, requestOptions);
    }
    /**
     * Retrieves a payment link.
     *
     * @param id The ID of link to retrieve.
     * @return Response from the API call
     */
    async retrievePaymentLink(id, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ id: [id, string()] });
        req.appendTemplatePath `/v2/online-checkout/payment-links/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrievePaymentLinkResponseSchema, requestOptions);
    }
    /**
     * Updates a payment link. You can update the `payment_link` fields such as
     * `description`, `checkout_options`, and  `pre_populated_data`.
     * You cannot update other fields such as the `order_id`, `version`, `URL`, or `timestamp` field.
     *
     * @param id           The ID of the payment link to update.
     * @param body         An object containing the fields to POST for the request.
     *                                                        See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async updatePaymentLink(id, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            id: [id, string()],
            body: [body, updatePaymentLinkRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/online-checkout/payment-links/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updatePaymentLinkResponseSchema, requestOptions);
    }
}

const bulkUpsertCustomerCustomAttributesRequestCustomerCustomAttributeUpsertRequestSchema = object({
    customerId: ['customer_id', string()],
    customAttribute: ['custom_attribute', lazy(() => customAttributeSchema)],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const bulkUpsertCustomerCustomAttributesRequestSchema = object({
    values: [
        'values',
        dict(lazy(() => bulkUpsertCustomerCustomAttributesRequestCustomerCustomAttributeUpsertRequestSchema)),
    ],
});

const bulkUpsertCustomerCustomAttributesResponseCustomerCustomAttributeUpsertResponseSchema = object({
    customerId: ['customer_id', optional(string())],
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkUpsertCustomerCustomAttributesResponseSchema = object({
    values: [
        'values',
        optional(dict(lazy(() => bulkUpsertCustomerCustomAttributesResponseCustomerCustomAttributeUpsertResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const createCustomerCustomAttributeDefinitionRequestSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        lazy(() => customAttributeDefinitionSchema),
    ],
    idempotencyKey: ['idempotency_key', optional(string())],
});

const createCustomerCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const deleteCustomerCustomAttributeDefinitionResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const deleteCustomerCustomAttributeResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const listCustomerCustomAttributeDefinitionsResponseSchema = object({
    customAttributeDefinitions: [
        'custom_attribute_definitions',
        optional(array(lazy(() => customAttributeDefinitionSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const listCustomerCustomAttributesResponseSchema = object({
    customAttributes: [
        'custom_attributes',
        optional(array(lazy(() => customAttributeSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveCustomerCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveCustomerCustomAttributeResponseSchema = object({
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateCustomerCustomAttributeDefinitionRequestSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        lazy(() => customAttributeDefinitionSchema),
    ],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const updateCustomerCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const upsertCustomerCustomAttributeRequestSchema = object({
    customAttribute: ['custom_attribute', lazy(() => customAttributeSchema)],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const upsertCustomerCustomAttributeResponseSchema = object({
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class CustomerCustomAttributesApi extends BaseApi {
    /**
     * Lists the customer-related [custom attribute definitions]($m/CustomAttributeDefinition) that belong
     * to a Square seller account.
     *
     * When all response pages are retrieved, the results include all custom attribute definitions
     * that are visible to the requesting application, including those that are created by other
     * applications and set to `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`. Note that
     * seller-defined custom attributes (also known as custom fields) are always set to
     * `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param limit  The maximum number of results to return in a single paged response. This limit is
     *                         advisory. The response might contain more or fewer results. The minimum value is 1 and the
     *                         maximum value is 100. The default value is 20. For more information, see
     *                         [Pagination](https://developer.squareup.com/docs/build-basics/common-api-
     *                         patterns/pagination).
     * @param cursor The cursor returned in the paged response from the previous call to this endpoint.
     *                         Provide this cursor to retrieve the next page of results for your original request. For
     *                         more information, see [Pagination](https://developer.squareup.com/docs/build-basics/common-
     *                         api-patterns/pagination).
     * @return Response from the API call
     */
    async listCustomerCustomAttributeDefinitions(limit, cursor, requestOptions) {
        const req = this.createRequest('GET', '/v2/customers/custom-attribute-definitions');
        const mapped = req.prepareArgs({
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
        });
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listCustomerCustomAttributeDefinitionsResponseSchema, requestOptions);
    }
    /**
     * Creates a customer-related [custom attribute definition]($m/CustomAttributeDefinition) for a Square
     * seller account.
     * Use this endpoint to define a custom attribute that can be associated with customer profiles.
     *
     * A custom attribute definition specifies the `key`, `visibility`, `schema`, and other properties
     * for a custom attribute. After the definition is created, you can call
     * [UpsertCustomerCustomAttribute]($e/CustomerCustomAttributes/UpsertCustomerCustomAttribute) or
     * [BulkUpsertCustomerCustomAttributes]($e/CustomerCustomAttributes/BulkUpsertCustomerCustomAttributes)
     * to set the custom attribute for customer profiles in the seller's Customer Directory.
     *
     * Sellers can view all custom attributes in exported customer data, including those set to
     * `VISIBILITY_HIDDEN`.
     *
     * @param body         An object containing the fields to
     *                                                                              POST for the request.  See the
     *                                                                              corresponding object definition for
     *                                                                              field details.
     * @return Response from the API call
     */
    async createCustomerCustomAttributeDefinition(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/customers/custom-attribute-definitions');
        const mapped = req.prepareArgs({
            body: [body, createCustomerCustomAttributeDefinitionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createCustomerCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Deletes a customer-related [custom attribute definition]($m/CustomAttributeDefinition) from a Square
     * seller account.
     *
     * Deleting a custom attribute definition also deletes the corresponding custom attribute from
     * all customer profiles in the seller's Customer Directory.
     *
     * Only the definition owner can delete a custom attribute definition.
     *
     * @param key The key of the custom attribute definition to delete.
     * @return Response from the API call
     */
    async deleteCustomerCustomAttributeDefinition(key, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({ key: [key, string()] });
        req.appendTemplatePath `/v2/customers/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteCustomerCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Retrieves a customer-related [custom attribute definition]($m/CustomAttributeDefinition) from a
     * Square seller account.
     *
     * To retrieve a custom attribute definition created by another application, the `visibility`
     * setting must be `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`. Note that seller-defined
     * custom attributes
     * (also known as custom fields) are always set to `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param key     The key of the custom attribute definition to retrieve. If the requesting application is
     *                          not the definition owner, you must use the qualified key.
     * @param version The current version of the custom attribute definition, which is used for strongly
     *                          consistent reads to guarantee that you receive the most up-to-date data. When included in
     *                          the request, Square returns the specified version or a higher version if one exists. If
     *                          the specified version is higher than the current version, Square returns a `BAD_REQUEST`
     *                          error.
     * @return Response from the API call
     */
    async retrieveCustomerCustomAttributeDefinition(key, version, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            key: [key, string()],
            version: [version, optional(number())],
        });
        req.query('version', mapped.version);
        req.appendTemplatePath `/v2/customers/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveCustomerCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Updates a customer-related [custom attribute definition]($m/CustomAttributeDefinition) for a Square
     * seller account.
     *
     * Use this endpoint to update the following fields: `name`, `description`, `visibility`, or the
     * `schema` for a `Selection` data type.
     *
     * Only the definition owner can update a custom attribute definition. Note that sellers can view
     * all custom attributes in exported customer data, including those set to `VISIBILITY_HIDDEN`.
     *
     * @param key          The key of the custom attribute
     *                                                                              definition to update.
     * @param body         An object containing the fields to
     *                                                                              POST for the request.  See the
     *                                                                              corresponding object definition for
     *                                                                              field details.
     * @return Response from the API call
     */
    async updateCustomerCustomAttributeDefinition(key, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            key: [key, string()],
            body: [body, updateCustomerCustomAttributeDefinitionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/customers/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateCustomerCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Creates or updates [custom attributes]($m/CustomAttribute) for customer profiles as a bulk operation.
     *
     * Use this endpoint to set the value of one or more custom attributes for one or more customer
     * profiles.
     * A custom attribute is based on a custom attribute definition in a Square seller account, which is
     * created using the
     * [CreateCustomerCustomAttributeDefinition]($e/CustomerCustomAttributes/CreateCustomerCustomAttributeD
     * efinition) endpoint.
     *
     * This `BulkUpsertCustomerCustomAttributes` endpoint accepts a map of 1 to 25 individual upsert
     * requests and returns a map of individual upsert responses. Each upsert request has a unique ID
     * and provides a customer ID and custom attribute. Each upsert response is returned with the ID
     * of the corresponding request.
     *
     * To create or update a custom attribute owned by another application, the `visibility` setting
     * must be `VISIBILITY_READ_WRITE_VALUES`. Note that seller-defined custom attributes
     * (also known as custom fields) are always set to `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param body         An object containing the fields to POST
     *                                                                         for the request.  See the corresponding
     *                                                                         object definition for field details.
     * @return Response from the API call
     */
    async bulkUpsertCustomerCustomAttributes(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/customers/custom-attributes/bulk-upsert');
        const mapped = req.prepareArgs({
            body: [body, bulkUpsertCustomerCustomAttributesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkUpsertCustomerCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Lists the [custom attributes]($m/CustomAttribute) associated with a customer profile.
     *
     * You can use the `with_definitions` query parameter to also retrieve custom attribute definitions
     * in the same call.
     *
     * When all response pages are retrieved, the results include all custom attributes that are
     * visible to the requesting application, including those that are owned by other applications
     * and set to `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param customerId       The ID of the target [customer profile](entity:Customer).
     * @param limit            The maximum number of results to return in a single paged response. This limit
     *                                    is advisory. The response might contain more or fewer results. The minimum
     *                                    value is 1 and the maximum value is 100. The default value is 20. For more
     *                                    information, see [Pagination](https://developer.squareup.com/docs/build-
     *                                    basics/common-api-patterns/pagination).
     * @param cursor           The cursor returned in the paged response from the previous call to this
     *                                    endpoint. Provide this cursor to retrieve the next page of results for your
     *                                    original request. For more information, see [Pagination](https://developer.
     *                                    squareup.com/docs/build-basics/common-api-patterns/pagination).
     * @param withDefinitions  Indicates whether to return the [custom attribute definition](entity:
     *                                    CustomAttributeDefinition) in the `definition` field of each custom attribute.
     *                                    Set this parameter to `true` to get the name and description of each custom
     *                                    attribute, information about the data type, or other definition details. The
     *                                    default value is `false`.
     * @return Response from the API call
     */
    async listCustomerCustomAttributes(customerId, limit, cursor, withDefinitions, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            customerId: [customerId, string()],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
            withDefinitions: [withDefinitions, optional(boolean())],
        });
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.query('with_definitions', mapped.withDefinitions);
        req.appendTemplatePath `/v2/customers/${mapped.customerId}/custom-attributes`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(listCustomerCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Deletes a [custom attribute]($m/CustomAttribute) associated with a customer profile.
     *
     * To delete a custom attribute owned by another application, the `visibility` setting must be
     * `VISIBILITY_READ_WRITE_VALUES`. Note that seller-defined custom attributes
     * (also known as custom fields) are always set to `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param customerId  The ID of the target [customer profile](entity:Customer).
     * @param key         The key of the custom attribute to delete. This key must match the `key` of a custom
     *                              attribute definition in the Square seller account. If the requesting application is
     *                              not the definition owner, you must use the qualified key.
     * @return Response from the API call
     */
    async deleteCustomerCustomAttribute(customerId, key, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            customerId: [customerId, string()],
            key: [key, string()],
        });
        req.appendTemplatePath `/v2/customers/${mapped.customerId}/custom-attributes/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteCustomerCustomAttributeResponseSchema, requestOptions);
    }
    /**
     * Retrieves a [custom attribute]($m/CustomAttribute) associated with a customer profile.
     *
     * You can use the `with_definition` query parameter to also retrieve the custom attribute definition
     * in the same call.
     *
     * To retrieve a custom attribute owned by another application, the `visibility` setting must be
     * `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`. Note that seller-defined custom
     * attributes
     * (also known as custom fields) are always set to `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param customerId      The ID of the target [customer profile](entity:Customer).
     * @param key             The key of the custom attribute to retrieve. This key must match the `key` of a
     *                                   custom attribute definition in the Square seller account. If the requesting
     *                                   application is not the definition owner, you must use the qualified key.
     * @param withDefinition  Indicates whether to return the [custom attribute definition](entity:
     *                                   CustomAttributeDefinition) in the `definition` field of the custom attribute.
     *                                   Set this parameter to `true` to get the name and description of the custom
     *                                   attribute, information about the data type, or other definition details. The
     *                                   default value is `false`.
     * @param version         The current version of the custom attribute, which is used for strongly
     *                                   consistent reads to guarantee that you receive the most up-to-date data. When
     *                                   included in the request, Square returns the specified version or a higher
     *                                   version if one exists. If the specified version is higher than the current
     *                                   version, Square returns a `BAD_REQUEST` error.
     * @return Response from the API call
     */
    async retrieveCustomerCustomAttribute(customerId, key, withDefinition, version, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            customerId: [customerId, string()],
            key: [key, string()],
            withDefinition: [withDefinition, optional(boolean())],
            version: [version, optional(number())],
        });
        req.query('with_definition', mapped.withDefinition);
        req.query('version', mapped.version);
        req.appendTemplatePath `/v2/customers/${mapped.customerId}/custom-attributes/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveCustomerCustomAttributeResponseSchema, requestOptions);
    }
    /**
     * Creates or updates a [custom attribute]($m/CustomAttribute) for a customer profile.
     *
     * Use this endpoint to set the value of a custom attribute for a specified customer profile.
     * A custom attribute is based on a custom attribute definition in a Square seller account, which
     * is created using the
     * [CreateCustomerCustomAttributeDefinition]($e/CustomerCustomAttributes/CreateCustomerCustomAttributeD
     * efinition) endpoint.
     *
     * To create or update a custom attribute owned by another application, the `visibility` setting
     * must be `VISIBILITY_READ_WRITE_VALUES`. Note that seller-defined custom attributes
     * (also known as custom fields) are always set to `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param customerId   The ID of the target [customer profile](entity:
     *                                                                    Customer).
     * @param key          The key of the custom attribute to create or
     *                                                                    update. This key must match the `key` of a
     *                                                                    custom attribute definition in the Square
     *                                                                    seller account. If the requesting application
     *                                                                    is not the definition owner, you must use the
     *                                                                    qualified key.
     * @param body         An object containing the fields to POST for
     *                                                                    the request.  See the corresponding object
     *                                                                    definition for field details.
     * @return Response from the API call
     */
    async upsertCustomerCustomAttribute(customerId, key, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            customerId: [customerId, string()],
            key: [key, string()],
            body: [body, upsertCustomerCustomAttributeRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/customers/${mapped.customerId}/custom-attributes/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(upsertCustomerCustomAttributeResponseSchema, requestOptions);
    }
}

const customerGroupSchema = object({
    id: ['id', optional(string())],
    name: ['name', string()],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
});

const createCustomerGroupRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(string())],
    group: ['group', lazy(() => customerGroupSchema)],
});

const createCustomerGroupResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    group: ['group', optional(lazy(() => customerGroupSchema))],
});

const deleteCustomerGroupResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const listCustomerGroupsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    groups: ['groups', optional(array(lazy(() => customerGroupSchema)))],
    cursor: ['cursor', optional(string())],
});

const retrieveCustomerGroupResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    group: ['group', optional(lazy(() => customerGroupSchema))],
});

const updateCustomerGroupRequestSchema = object({ group: ['group', lazy(() => customerGroupSchema)] });

const updateCustomerGroupResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    group: ['group', optional(lazy(() => customerGroupSchema))],
});

class CustomerGroupsApi extends BaseApi {
    /**
     * Retrieves the list of customer groups of a business.
     *
     * @param cursor A pagination cursor returned by a previous call to this endpoint. Provide this cursor to
     *                         retrieve the next set of results for your original query.  For more information, see
     *                         [Pagination](https://developer.squareup.com/docs/build-basics/common-api-
     *                         patterns/pagination).
     * @param limit  The maximum number of results to return in a single page. This limit is advisory. The
     *                         response might contain more or fewer results. If the limit is less than 1 or greater than
     *                         50, Square returns a `400 VALUE_TOO_LOW` or `400 VALUE_TOO_HIGH` error. The default value
     *                         is 50.  For more information, see [Pagination](https://developer.squareup.com/docs/build-
     *                         basics/common-api-patterns/pagination).
     * @return Response from the API call
     */
    async listCustomerGroups(cursor, limit, requestOptions) {
        const req = this.createRequest('GET', '/v2/customers/groups');
        const mapped = req.prepareArgs({
            cursor: [cursor, optional(string())],
            limit: [limit, optional(number())],
        });
        req.query('cursor', mapped.cursor);
        req.query('limit', mapped.limit);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listCustomerGroupsResponseSchema, requestOptions);
    }
    /**
     * Creates a new customer group for a business.
     *
     * The request must include the `name` value of the group.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async createCustomerGroup(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/customers/groups');
        const mapped = req.prepareArgs({
            body: [body, createCustomerGroupRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createCustomerGroupResponseSchema, requestOptions);
    }
    /**
     * Deletes a customer group as identified by the `group_id` value.
     *
     * @param groupId  The ID of the customer group to delete.
     * @return Response from the API call
     */
    async deleteCustomerGroup(groupId, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({ groupId: [groupId, string()] });
        req.appendTemplatePath `/v2/customers/groups/${mapped.groupId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteCustomerGroupResponseSchema, requestOptions);
    }
    /**
     * Retrieves a specific customer group as identified by the `group_id` value.
     *
     * @param groupId  The ID of the customer group to retrieve.
     * @return Response from the API call
     */
    async retrieveCustomerGroup(groupId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ groupId: [groupId, string()] });
        req.appendTemplatePath `/v2/customers/groups/${mapped.groupId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveCustomerGroupResponseSchema, requestOptions);
    }
    /**
     * Updates a customer group as identified by the `group_id` value.
     *
     * @param groupId      The ID of the customer group to update.
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async updateCustomerGroup(groupId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            groupId: [groupId, string()],
            body: [body, updateCustomerGroupRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/customers/groups/${mapped.groupId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateCustomerGroupResponseSchema, requestOptions);
    }
}

const addGroupToCustomerResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const customerTaxIdsSchema = object({
    euVat: ['eu_vat', optional(nullable(string()))],
});

const bulkCreateCustomerDataSchema = object({
    givenName: ['given_name', optional(nullable(string()))],
    familyName: ['family_name', optional(nullable(string()))],
    companyName: ['company_name', optional(nullable(string()))],
    nickname: ['nickname', optional(nullable(string()))],
    emailAddress: ['email_address', optional(nullable(string()))],
    address: ['address', optional(lazy(() => addressSchema))],
    phoneNumber: ['phone_number', optional(nullable(string()))],
    referenceId: ['reference_id', optional(nullable(string()))],
    note: ['note', optional(nullable(string()))],
    birthday: ['birthday', optional(nullable(string()))],
    taxIds: ['tax_ids', optional(lazy(() => customerTaxIdsSchema))],
});

const bulkCreateCustomersRequestSchema = object({ customers: ['customers', dict(lazy(() => bulkCreateCustomerDataSchema))] });

const customerPreferencesSchema = object({
    emailUnsubscribed: ['email_unsubscribed', optional(nullable(boolean()))],
});

const customerSchema = object({
    id: ['id', optional(string())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    cards: ['cards', optional(nullable(array(lazy(() => cardSchema))))],
    givenName: ['given_name', optional(nullable(string()))],
    familyName: ['family_name', optional(nullable(string()))],
    nickname: ['nickname', optional(nullable(string()))],
    companyName: ['company_name', optional(nullable(string()))],
    emailAddress: ['email_address', optional(nullable(string()))],
    address: ['address', optional(lazy(() => addressSchema))],
    phoneNumber: ['phone_number', optional(nullable(string()))],
    birthday: ['birthday', optional(nullable(string()))],
    referenceId: ['reference_id', optional(nullable(string()))],
    note: ['note', optional(nullable(string()))],
    preferences: ['preferences', optional(lazy(() => customerPreferencesSchema))],
    creationSource: ['creation_source', optional(string())],
    groupIds: ['group_ids', optional(nullable(array(string())))],
    segmentIds: ['segment_ids', optional(nullable(array(string())))],
    version: ['version', optional(bigint())],
    taxIds: ['tax_ids', optional(lazy(() => customerTaxIdsSchema))],
});

const createCustomerResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    customer: ['customer', optional(lazy(() => customerSchema))],
});

const bulkCreateCustomersResponseSchema = object({
    responses: [
        'responses',
        optional(dict(lazy(() => createCustomerResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkDeleteCustomersRequestSchema = object({ customerIds: ['customer_ids', array(string())] });

const deleteCustomerResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const bulkDeleteCustomersResponseSchema = object({
    responses: [
        'responses',
        optional(dict(lazy(() => deleteCustomerResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkRetrieveCustomersRequestSchema = object({ customerIds: ['customer_ids', array(string())] });

const retrieveCustomerResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    customer: ['customer', optional(lazy(() => customerSchema))],
});

const bulkRetrieveCustomersResponseSchema = object({
    responses: [
        'responses',
        optional(dict(lazy(() => retrieveCustomerResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkUpdateCustomerDataSchema = object({
    givenName: ['given_name', optional(nullable(string()))],
    familyName: ['family_name', optional(nullable(string()))],
    companyName: ['company_name', optional(nullable(string()))],
    nickname: ['nickname', optional(nullable(string()))],
    emailAddress: ['email_address', optional(nullable(string()))],
    address: ['address', optional(lazy(() => addressSchema))],
    phoneNumber: ['phone_number', optional(nullable(string()))],
    referenceId: ['reference_id', optional(nullable(string()))],
    note: ['note', optional(nullable(string()))],
    birthday: ['birthday', optional(nullable(string()))],
    taxIds: ['tax_ids', optional(lazy(() => customerTaxIdsSchema))],
    version: ['version', optional(bigint())],
});

const bulkUpdateCustomersRequestSchema = object({ customers: ['customers', dict(lazy(() => bulkUpdateCustomerDataSchema))] });

const updateCustomerResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    customer: ['customer', optional(lazy(() => customerSchema))],
});

const bulkUpdateCustomersResponseSchema = object({
    responses: [
        'responses',
        optional(dict(lazy(() => updateCustomerResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const createCustomerCardRequestSchema = object({
    cardNonce: ['card_nonce', string()],
    billingAddress: ['billing_address', optional(lazy(() => addressSchema))],
    cardholderName: ['cardholder_name', optional(string())],
    verificationToken: ['verification_token', optional(string())],
});

const createCustomerCardResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    card: ['card', optional(lazy(() => cardSchema))],
});

const createCustomerRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(string())],
    givenName: ['given_name', optional(string())],
    familyName: ['family_name', optional(string())],
    companyName: ['company_name', optional(string())],
    nickname: ['nickname', optional(string())],
    emailAddress: ['email_address', optional(string())],
    address: ['address', optional(lazy(() => addressSchema))],
    phoneNumber: ['phone_number', optional(string())],
    referenceId: ['reference_id', optional(string())],
    note: ['note', optional(string())],
    birthday: ['birthday', optional(string())],
    taxIds: ['tax_ids', optional(lazy(() => customerTaxIdsSchema))],
});

const deleteCustomerCardResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const listCustomersResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    customers: ['customers', optional(array(lazy(() => customerSchema)))],
    cursor: ['cursor', optional(string())],
    count: ['count', optional(bigint())],
});

const removeGroupFromCustomerResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const customerCreationSourceFilterSchema = object({
    values: ['values', optional(nullable(array(string())))],
    rule: ['rule', optional(string())],
});

const customerTextFilterSchema = object({
    exact: ['exact', optional(nullable(string()))],
    fuzzy: ['fuzzy', optional(nullable(string()))],
});

const customerAddressFilterSchema = object({
    postalCode: ['postal_code', optional(lazy(() => customerTextFilterSchema))],
    country: ['country', optional(string())],
});

const floatNumberRangeSchema = object({
    startAt: ['start_at', optional(nullable(string()))],
    endAt: ['end_at', optional(nullable(string()))],
});

const customerCustomAttributeFilterValueSchema = object({
    email: ['email', optional(lazy(() => customerTextFilterSchema))],
    phone: ['phone', optional(lazy(() => customerTextFilterSchema))],
    text: ['text', optional(lazy(() => customerTextFilterSchema))],
    selection: ['selection', optional(lazy(() => filterValueSchema))],
    date: ['date', optional(lazy(() => timeRangeSchema))],
    number: ['number', optional(lazy(() => floatNumberRangeSchema))],
    mBoolean: ['boolean', optional(nullable(boolean()))],
    address: ['address', optional(lazy(() => customerAddressFilterSchema))],
});

const customerCustomAttributeFilterSchema = object({
    key: ['key', string()],
    filter: [
        'filter',
        optional(lazy(() => customerCustomAttributeFilterValueSchema)),
    ],
    updatedAt: ['updated_at', optional(lazy(() => timeRangeSchema))],
});

const customerCustomAttributeFiltersSchema = object({
    filters: [
        'filters',
        optional(nullable(array(lazy(() => customerCustomAttributeFilterSchema)))),
    ],
});

const customerFilterSchema = object({
    creationSource: [
        'creation_source',
        optional(lazy(() => customerCreationSourceFilterSchema)),
    ],
    createdAt: ['created_at', optional(lazy(() => timeRangeSchema))],
    updatedAt: ['updated_at', optional(lazy(() => timeRangeSchema))],
    emailAddress: [
        'email_address',
        optional(lazy(() => customerTextFilterSchema)),
    ],
    phoneNumber: ['phone_number', optional(lazy(() => customerTextFilterSchema))],
    referenceId: ['reference_id', optional(lazy(() => customerTextFilterSchema))],
    groupIds: ['group_ids', optional(lazy(() => filterValueSchema))],
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customerCustomAttributeFiltersSchema)),
    ],
    segmentIds: ['segment_ids', optional(lazy(() => filterValueSchema))],
});

const customerSortSchema = object({
    field: ['field', optional(string())],
    order: ['order', optional(string())],
});

const customerQuerySchema = object({
    filter: ['filter', optional(lazy(() => customerFilterSchema))],
    sort: ['sort', optional(lazy(() => customerSortSchema))],
});

const searchCustomersRequestSchema = object({
    cursor: ['cursor', optional(string())],
    limit: ['limit', optional(bigint())],
    query: ['query', optional(lazy(() => customerQuerySchema))],
    count: ['count', optional(boolean())],
});

const searchCustomersResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    customers: ['customers', optional(array(lazy(() => customerSchema)))],
    cursor: ['cursor', optional(string())],
    count: ['count', optional(bigint())],
});

const updateCustomerRequestSchema = object({
    givenName: ['given_name', optional(nullable(string()))],
    familyName: ['family_name', optional(nullable(string()))],
    companyName: ['company_name', optional(nullable(string()))],
    nickname: ['nickname', optional(nullable(string()))],
    emailAddress: ['email_address', optional(nullable(string()))],
    address: ['address', optional(lazy(() => addressSchema))],
    phoneNumber: ['phone_number', optional(nullable(string()))],
    referenceId: ['reference_id', optional(nullable(string()))],
    note: ['note', optional(nullable(string()))],
    birthday: ['birthday', optional(nullable(string()))],
    version: ['version', optional(bigint())],
    taxIds: ['tax_ids', optional(lazy(() => customerTaxIdsSchema))],
});

class CustomersApi extends BaseApi {
    /**
     * Lists customer profiles associated with a Square account.
     *
     * Under normal operating conditions, newly created or updated customer profiles become available
     * for the listing operation in well under 30 seconds. Occasionally, propagation of the new or updated
     * profiles can take closer to one minute or longer, especially during network incidents and outages.
     *
     * @param cursor     A pagination cursor returned by a previous call to this endpoint. Provide this
     *                              cursor to retrieve the next set of results for your original query.  For more
     *                              information, see [Pagination](https://developer.squareup.com/docs/build-basics/common-
     *                              api-patterns/pagination).
     * @param limit      The maximum number of results to return in a single page. This limit is advisory.
     *                              The response might contain more or fewer results. If the specified limit is less than
     *                              1 or greater than 100, Square returns a `400 VALUE_TOO_LOW` or `400 VALUE_TOO_HIGH`
     *                              error. The default value is 100.  For more information, see [Pagination](https:
     *                              //developer.squareup.com/docs/build-basics/common-api-patterns/pagination).
     * @param sortField  Indicates how customers should be sorted.  The default value is `DEFAULT`.
     * @param sortOrder  Indicates whether customers should be sorted in ascending (`ASC`) or descending
     *                              (`DESC`) order.  The default value is `ASC`.
     * @param count      Indicates whether to return the total count of customers in the `count` field of the
     *                              response.  The default value is `false`.
     * @return Response from the API call
     */
    async listCustomers(cursor, limit, sortField, sortOrder, count, requestOptions) {
        const req = this.createRequest('GET', '/v2/customers');
        const mapped = req.prepareArgs({
            cursor: [cursor, optional(string())],
            limit: [limit, optional(number())],
            sortField: [sortField, optional(string())],
            sortOrder: [sortOrder, optional(string())],
            count: [count, optional(boolean())],
        });
        req.query('cursor', mapped.cursor);
        req.query('limit', mapped.limit);
        req.query('sort_field', mapped.sortField);
        req.query('sort_order', mapped.sortOrder);
        req.query('count', mapped.count);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listCustomersResponseSchema, requestOptions);
    }
    /**
     * Creates a new customer for a business.
     *
     * You must provide at least one of the following values in your request to this
     * endpoint:
     *
     * - `given_name`
     * - `family_name`
     * - `company_name`
     * - `email_address`
     * - `phone_number`
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                     the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createCustomer(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/customers');
        const mapped = req.prepareArgs({
            body: [body, createCustomerRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createCustomerResponseSchema, requestOptions);
    }
    /**
     * Creates multiple [customer profiles]($m/Customer) for a business.
     *
     * This endpoint takes a map of individual create requests and returns a map of responses.
     *
     * You must provide at least one of the following values in each create request:
     *
     * - `given_name`
     * - `family_name`
     * - `company_name`
     * - `email_address`
     * - `phone_number`
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async bulkCreateCustomers(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/customers/bulk-create');
        const mapped = req.prepareArgs({
            body: [body, bulkCreateCustomersRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkCreateCustomersResponseSchema, requestOptions);
    }
    /**
     * Deletes multiple customer profiles.
     *
     * The endpoint takes a list of customer IDs and returns a map of responses.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async bulkDeleteCustomers(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/customers/bulk-delete');
        const mapped = req.prepareArgs({
            body: [body, bulkDeleteCustomersRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkDeleteCustomersResponseSchema, requestOptions);
    }
    /**
     * Retrieves multiple customer profiles.
     *
     * This endpoint takes a list of customer IDs and returns a map of responses.
     *
     * @param body         An object containing the fields to POST for the
     *                                                            request.  See the corresponding object definition for
     *                                                            field details.
     * @return Response from the API call
     */
    async bulkRetrieveCustomers(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/customers/bulk-retrieve');
        const mapped = req.prepareArgs({
            body: [body, bulkRetrieveCustomersRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkRetrieveCustomersResponseSchema, requestOptions);
    }
    /**
     * Updates multiple customer profiles.
     *
     * This endpoint takes a map of individual update requests and returns a map of responses.
     *
     * You cannot use this endpoint to change cards on file. To make changes, use the [Cards API]($e/Cards)
     * or [Gift Cards API]($e/GiftCards).
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async bulkUpdateCustomers(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/customers/bulk-update');
        const mapped = req.prepareArgs({
            body: [body, bulkUpdateCustomersRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkUpdateCustomersResponseSchema, requestOptions);
    }
    /**
     * Searches the customer profiles associated with a Square account using one or more supported query
     * filters.
     *
     * Calling `SearchCustomers` without any explicit query filter returns all
     * customer profiles ordered alphabetically based on `given_name` and
     * `family_name`.
     *
     * Under normal operating conditions, newly created or updated customer profiles become available
     * for the search operation in well under 30 seconds. Occasionally, propagation of the new or updated
     * profiles can take closer to one minute or longer, especially during network incidents and outages.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                      See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async searchCustomers(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/customers/search');
        const mapped = req.prepareArgs({
            body: [body, searchCustomersRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchCustomersResponseSchema, requestOptions);
    }
    /**
     * Deletes a customer profile from a business. This operation also unlinks any associated cards on file.
     *
     * To delete a customer profile that was created by merging existing profiles, you must use the ID of
     * the newly created profile.
     *
     * @param customerId  The ID of the customer to delete.
     * @param version     The current version of the customer profile.  As a best practice, you should include
     *                              this parameter to enable [optimistic concurrency](https://developer.squareup.
     *                              com/docs/build-basics/common-api-patterns/optimistic-concurrency) control.  For more
     *                              information, see [Delete a customer profile](https://developer.squareup.
     *                              com/docs/customers-api/use-the-api/keep-records#delete-customer-profile).
     * @return Response from the API call
     */
    async deleteCustomer(customerId, version, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            customerId: [customerId, string()],
            version: [version, optional(bigint())],
        });
        req.query('version', mapped.version);
        req.appendTemplatePath `/v2/customers/${mapped.customerId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteCustomerResponseSchema, requestOptions);
    }
    /**
     * Returns details for a single customer.
     *
     * @param customerId  The ID of the customer to retrieve.
     * @return Response from the API call
     */
    async retrieveCustomer(customerId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ customerId: [customerId, string()] });
        req.appendTemplatePath `/v2/customers/${mapped.customerId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveCustomerResponseSchema, requestOptions);
    }
    /**
     * Updates a customer profile. This endpoint supports sparse updates, so only new or changed fields are
     * required in the request.
     * To add or update a field, specify the new value. To remove a field, specify `null`.
     *
     * To update a customer profile that was created by merging existing profiles, you must use the ID of
     * the newly created profile.
     *
     * You cannot use this endpoint to change cards on file. To make changes, use the [Cards API]($e/Cards)
     * or [Gift Cards API]($e/GiftCards).
     *
     * @param customerId   The ID of the customer to update.
     * @param body         An object containing the fields to POST for the request.  See
     *                                                     the corresponding object definition for field details.
     * @return Response from the API call
     */
    async updateCustomer(customerId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            customerId: [customerId, string()],
            body: [body, updateCustomerRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/customers/${mapped.customerId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateCustomerResponseSchema, requestOptions);
    }
    /**
     * Adds a card on file to an existing customer.
     *
     * As with charges, calls to `CreateCustomerCard` are idempotent. Multiple
     * calls with the same card nonce return the same card record that was created
     * with the provided nonce during the _first_ call.
     *
     * @param customerId   The Square ID of the customer profile the card is linked
     *                                                         to.
     * @param body         An object containing the fields to POST for the request.
     *                                                         See the corresponding object definition for field details.
     * @return Response from the API call
     * @deprecated
     */
    async createCustomerCard(customerId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            customerId: [customerId, string()],
            body: [body, createCustomerCardRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/customers/${mapped.customerId}/cards`;
        req.deprecated('CustomersApi.createCustomerCard');
        req.authenticate([{ global: true }]);
        return req.callAsJson(createCustomerCardResponseSchema, requestOptions);
    }
    /**
     * Removes a card on file from a customer.
     *
     * @param customerId  The ID of the customer that the card on file belongs to.
     * @param cardId      The ID of the card on file to delete.
     * @return Response from the API call
     * @deprecated
     */
    async deleteCustomerCard(customerId, cardId, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            customerId: [customerId, string()],
            cardId: [cardId, string()],
        });
        req.appendTemplatePath `/v2/customers/${mapped.customerId}/cards/${mapped.cardId}`;
        req.deprecated('CustomersApi.deleteCustomerCard');
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteCustomerCardResponseSchema, requestOptions);
    }
    /**
     * Removes a group membership from a customer.
     *
     * The customer is identified by the `customer_id` value
     * and the customer group is identified by the `group_id` value.
     *
     * @param customerId  The ID of the customer to remove from the group.
     * @param groupId     The ID of the customer group to remove the customer from.
     * @return Response from the API call
     */
    async removeGroupFromCustomer(customerId, groupId, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            customerId: [customerId, string()],
            groupId: [groupId, string()],
        });
        req.appendTemplatePath `/v2/customers/${mapped.customerId}/groups/${mapped.groupId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(removeGroupFromCustomerResponseSchema, requestOptions);
    }
    /**
     * Adds a group membership to a customer.
     *
     * The customer is identified by the `customer_id` value
     * and the customer group is identified by the `group_id` value.
     *
     * @param customerId  The ID of the customer to add to a group.
     * @param groupId     The ID of the customer group to add the customer to.
     * @return Response from the API call
     */
    async addGroupToCustomer(customerId, groupId, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            customerId: [customerId, string()],
            groupId: [groupId, string()],
        });
        req.appendTemplatePath `/v2/customers/${mapped.customerId}/groups/${mapped.groupId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(addGroupToCustomerResponseSchema, requestOptions);
    }
}

const customerSegmentSchema = object({
    id: ['id', optional(string())],
    name: ['name', string()],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
});

const listCustomerSegmentsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    segments: ['segments', optional(array(lazy(() => customerSegmentSchema)))],
    cursor: ['cursor', optional(string())],
});

const retrieveCustomerSegmentResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    segment: ['segment', optional(lazy(() => customerSegmentSchema))],
});

class CustomerSegmentsApi extends BaseApi {
    /**
     * Retrieves the list of customer segments of a business.
     *
     * @param cursor A pagination cursor returned by previous calls to `ListCustomerSegments`. This cursor is
     *                         used to retrieve the next set of query results.  For more information, see
     *                         [Pagination](https://developer.squareup.com/docs/build-basics/common-api-
     *                         patterns/pagination).
     * @param limit  The maximum number of results to return in a single page. This limit is advisory. The
     *                         response might contain more or fewer results. If the specified limit is less than 1 or
     *                         greater than 50, Square returns a `400 VALUE_TOO_LOW` or `400 VALUE_TOO_HIGH` error. The
     *                         default value is 50.  For more information, see [Pagination](https://developer.squareup.
     *                         com/docs/build-basics/common-api-patterns/pagination).
     * @return Response from the API call
     */
    async listCustomerSegments(cursor, limit, requestOptions) {
        const req = this.createRequest('GET', '/v2/customers/segments');
        const mapped = req.prepareArgs({
            cursor: [cursor, optional(string())],
            limit: [limit, optional(number())],
        });
        req.query('cursor', mapped.cursor);
        req.query('limit', mapped.limit);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listCustomerSegmentsResponseSchema, requestOptions);
    }
    /**
     * Retrieves a specific customer segment as identified by the `segment_id` value.
     *
     * @param segmentId  The Square-issued ID of the customer segment.
     * @return Response from the API call
     */
    async retrieveCustomerSegment(segmentId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ segmentId: [segmentId, string()] });
        req.appendTemplatePath `/v2/customers/segments/${mapped.segmentId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveCustomerSegmentResponseSchema, requestOptions);
    }
}

const deviceCodeSchema = object({
    id: ['id', optional(string())],
    name: ['name', optional(nullable(string()))],
    code: ['code', optional(string())],
    deviceId: ['device_id', optional(string())],
    productType: ['product_type', string()],
    locationId: ['location_id', optional(nullable(string()))],
    status: ['status', optional(string())],
    pairBy: ['pair_by', optional(string())],
    createdAt: ['created_at', optional(string())],
    statusChangedAt: ['status_changed_at', optional(string())],
    pairedAt: ['paired_at', optional(string())],
});

const createDeviceCodeRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    deviceCode: ['device_code', lazy(() => deviceCodeSchema)],
});

const createDeviceCodeResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    deviceCode: ['device_code', optional(lazy(() => deviceCodeSchema))],
});

const getDeviceCodeResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    deviceCode: ['device_code', optional(lazy(() => deviceCodeSchema))],
});

const deviceComponentDetailsApplicationDetailsSchema = object({
    applicationType: ['application_type', optional(string())],
    version: ['version', optional(string())],
    sessionLocation: ['session_location', optional(nullable(string()))],
    deviceCodeId: ['device_code_id', optional(nullable(string()))],
});

const deviceComponentDetailsBatteryDetailsSchema = object({
    visiblePercent: ['visible_percent', optional(nullable(number()))],
    externalPower: ['external_power', optional(string())],
});

const deviceComponentDetailsCardReaderDetailsSchema = object({ version: ['version', optional(string())] });

const deviceComponentDetailsEthernetDetailsSchema = object({
    active: ['active', optional(nullable(boolean()))],
    ipAddressV4: ['ip_address_v4', optional(nullable(string()))],
});

const deviceComponentDetailsMeasurementSchema = object({ value: ['value', optional(nullable(number()))] });

const deviceComponentDetailsWiFiDetailsSchema = object({
    active: ['active', optional(nullable(boolean()))],
    ssid: ['ssid', optional(nullable(string()))],
    ipAddressV4: ['ip_address_v4', optional(nullable(string()))],
    secureConnection: ['secure_connection', optional(nullable(string()))],
    signalStrength: [
        'signal_strength',
        optional(lazy(() => deviceComponentDetailsMeasurementSchema)),
    ],
});

const componentSchema = object({
    type: ['type', string()],
    applicationDetails: [
        'application_details',
        optional(lazy(() => deviceComponentDetailsApplicationDetailsSchema)),
    ],
    cardReaderDetails: [
        'card_reader_details',
        optional(lazy(() => deviceComponentDetailsCardReaderDetailsSchema)),
    ],
    batteryDetails: [
        'battery_details',
        optional(lazy(() => deviceComponentDetailsBatteryDetailsSchema)),
    ],
    wifiDetails: [
        'wifi_details',
        optional(lazy(() => deviceComponentDetailsWiFiDetailsSchema)),
    ],
    ethernetDetails: [
        'ethernet_details',
        optional(lazy(() => deviceComponentDetailsEthernetDetailsSchema)),
    ],
});

const deviceAttributesSchema = object({
    type: ['type', string()],
    manufacturer: ['manufacturer', string()],
    model: ['model', optional(nullable(string()))],
    name: ['name', optional(nullable(string()))],
    manufacturersId: ['manufacturers_id', optional(nullable(string()))],
    updatedAt: ['updated_at', optional(string())],
    version: ['version', optional(string())],
    merchantToken: ['merchant_token', optional(nullable(string()))],
});

const deviceStatusSchema = object({
    category: ['category', optional(string())],
});

const deviceSchema = object({
    id: ['id', optional(string())],
    attributes: ['attributes', lazy(() => deviceAttributesSchema)],
    components: [
        'components',
        optional(nullable(array(lazy(() => componentSchema)))),
    ],
    status: ['status', optional(lazy(() => deviceStatusSchema))],
});

const getDeviceResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    device: ['device', optional(lazy(() => deviceSchema))],
});

const listDeviceCodesResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    deviceCodes: [
        'device_codes',
        optional(array(lazy(() => deviceCodeSchema))),
    ],
    cursor: ['cursor', optional(string())],
});

const listDevicesResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    devices: ['devices', optional(array(lazy(() => deviceSchema)))],
    cursor: ['cursor', optional(string())],
});

class DevicesApi extends BaseApi {
    /**
     * List devices associated with the merchant. Currently, only Terminal API
     * devices are supported.
     *
     * @param cursor      A pagination cursor returned by a previous call to this endpoint. Provide this
     *                              cursor to retrieve the next set of results for the original query. See
     *                              [Pagination](https://developer.squareup.com/docs/build-basics/common-api-
     *                              patterns/pagination) for more information.
     * @param sortOrder   The order in which results are listed. - `ASC` - Oldest to newest. - `DESC` - Newest
     *                              to oldest (default).
     * @param limit       The number of results to return in a single page.
     * @param locationId  If present, only returns devices at the target location.
     * @return Response from the API call
     */
    async listDevices(cursor, sortOrder, limit, locationId, requestOptions) {
        const req = this.createRequest('GET', '/v2/devices');
        const mapped = req.prepareArgs({
            cursor: [cursor, optional(string())],
            sortOrder: [sortOrder, optional(string())],
            limit: [limit, optional(number())],
            locationId: [locationId, optional(string())],
        });
        req.query('cursor', mapped.cursor);
        req.query('sort_order', mapped.sortOrder);
        req.query('limit', mapped.limit);
        req.query('location_id', mapped.locationId);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listDevicesResponseSchema, requestOptions);
    }
    /**
     * Lists all DeviceCodes associated with the merchant.
     *
     * @param cursor       A pagination cursor returned by a previous call to this endpoint. Provide this to
     *                               retrieve the next set of results for your original query.  See [Paginating
     *                               results](https://developer.squareup.com/docs/working-with-apis/pagination) for more
     *                               information.
     * @param locationId   If specified, only returns DeviceCodes of the specified location. Returns
     *                               DeviceCodes of all locations if empty.
     * @param productType  If specified, only returns DeviceCodes targeting the specified product type.
     *                               Returns DeviceCodes of all product types if empty.
     * @param status       If specified, returns DeviceCodes with the specified statuses. Returns DeviceCodes
     *                               of status `PAIRED` and `UNPAIRED` if empty.
     * @return Response from the API call
     */
    async listDeviceCodes(cursor, locationId, productType, status, requestOptions) {
        const req = this.createRequest('GET', '/v2/devices/codes');
        const mapped = req.prepareArgs({
            cursor: [cursor, optional(string())],
            locationId: [locationId, optional(string())],
            productType: [productType, optional(string())],
            status: [status, optional(string())],
        });
        req.query('cursor', mapped.cursor);
        req.query('location_id', mapped.locationId);
        req.query('product_type', mapped.productType);
        req.query('status', mapped.status);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listDeviceCodesResponseSchema, requestOptions);
    }
    /**
     * Creates a DeviceCode that can be used to login to a Square Terminal device to enter the connected
     * terminal mode.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                       See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createDeviceCode(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/devices/codes');
        const mapped = req.prepareArgs({
            body: [body, createDeviceCodeRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createDeviceCodeResponseSchema, requestOptions);
    }
    /**
     * Retrieves DeviceCode with the associated ID.
     *
     * @param id The unique identifier for the device code.
     * @return Response from the API call
     */
    async getDeviceCode(id, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ id: [id, string()] });
        req.appendTemplatePath `/v2/devices/codes/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getDeviceCodeResponseSchema, requestOptions);
    }
    /**
     * Retrieves Device with the associated `device_id`.
     *
     * @param deviceId  The unique ID for the desired `Device`.
     * @return Response from the API call
     */
    async getDevice(deviceId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ deviceId: [deviceId, string()] });
        req.appendTemplatePath `/v2/devices/${mapped.deviceId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getDeviceResponseSchema, requestOptions);
    }
}

const disputedPaymentSchema = object({
    paymentId: ['payment_id', optional(nullable(string()))],
});

const disputeSchema = object({
    disputeId: ['dispute_id', optional(nullable(string()))],
    id: ['id', optional(string())],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    reason: ['reason', optional(string())],
    state: ['state', optional(string())],
    dueAt: ['due_at', optional(nullable(string()))],
    disputedPayment: [
        'disputed_payment',
        optional(lazy(() => disputedPaymentSchema)),
    ],
    evidenceIds: ['evidence_ids', optional(nullable(array(string())))],
    cardBrand: ['card_brand', optional(string())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    brandDisputeId: ['brand_dispute_id', optional(nullable(string()))],
    reportedDate: ['reported_date', optional(nullable(string()))],
    reportedAt: ['reported_at', optional(nullable(string()))],
    version: ['version', optional(number())],
    locationId: ['location_id', optional(nullable(string()))],
});

const acceptDisputeResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    dispute: ['dispute', optional(lazy(() => disputeSchema))],
});

const createDisputeEvidenceFileRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    evidenceType: ['evidence_type', optional(string())],
    contentType: ['content_type', optional(string())],
});

const disputeEvidenceFileSchema = object({
    filename: ['filename', optional(nullable(string()))],
    filetype: ['filetype', optional(nullable(string()))],
});

const disputeEvidenceSchema = object({
    evidenceId: ['evidence_id', optional(nullable(string()))],
    id: ['id', optional(string())],
    disputeId: ['dispute_id', optional(nullable(string()))],
    evidenceFile: [
        'evidence_file',
        optional(lazy(() => disputeEvidenceFileSchema)),
    ],
    evidenceText: ['evidence_text', optional(nullable(string()))],
    uploadedAt: ['uploaded_at', optional(nullable(string()))],
    evidenceType: ['evidence_type', optional(string())],
});

const createDisputeEvidenceFileResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    evidence: ['evidence', optional(lazy(() => disputeEvidenceSchema))],
});

const createDisputeEvidenceTextRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    evidenceType: ['evidence_type', optional(string())],
    evidenceText: ['evidence_text', string()],
});

const createDisputeEvidenceTextResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    evidence: ['evidence', optional(lazy(() => disputeEvidenceSchema))],
});

const deleteDisputeEvidenceResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const listDisputeEvidenceResponseSchema = object({
    evidence: ['evidence', optional(array(lazy(() => disputeEvidenceSchema)))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    cursor: ['cursor', optional(string())],
});

const listDisputesResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    disputes: ['disputes', optional(array(lazy(() => disputeSchema)))],
    cursor: ['cursor', optional(string())],
});

const retrieveDisputeEvidenceResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    evidence: ['evidence', optional(lazy(() => disputeEvidenceSchema))],
});

const retrieveDisputeResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    dispute: ['dispute', optional(lazy(() => disputeSchema))],
});

const submitEvidenceResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    dispute: ['dispute', optional(lazy(() => disputeSchema))],
});

class DisputesApi extends BaseApi {
    /**
     * Returns a list of disputes associated with a particular account.
     *
     * @param cursor      A pagination cursor returned by a previous call to this endpoint. Provide this
     *                              cursor to retrieve the next set of results for the original query. For more
     *                              information, see [Pagination](https://developer.squareup.com/docs/build-basics/common-
     *                              api-patterns/pagination).
     * @param states      The dispute states used to filter the result. If not specified, the endpoint returns
     *                              all disputes.
     * @param locationId  The ID of the location for which to return a list of disputes. If not specified, the
     *                              endpoint returns disputes associated with all locations.
     * @return Response from the API call
     */
    async listDisputes(cursor, states, locationId, requestOptions) {
        const req = this.createRequest('GET', '/v2/disputes');
        const mapped = req.prepareArgs({
            cursor: [cursor, optional(string())],
            states: [states, optional(string())],
            locationId: [locationId, optional(string())],
        });
        req.query('cursor', mapped.cursor);
        req.query('states', mapped.states);
        req.query('location_id', mapped.locationId);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listDisputesResponseSchema, requestOptions);
    }
    /**
     * Returns details about a specific dispute.
     *
     * @param disputeId  The ID of the dispute you want more details about.
     * @return Response from the API call
     */
    async retrieveDispute(disputeId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ disputeId: [disputeId, string()] });
        req.appendTemplatePath `/v2/disputes/${mapped.disputeId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveDisputeResponseSchema, requestOptions);
    }
    /**
     * Accepts the loss on a dispute. Square returns the disputed amount to the cardholder and
     * updates the dispute state to ACCEPTED.
     *
     * Square debits the disputed amount from the seller’s Square account. If the Square account
     * does not have sufficient funds, Square debits the associated bank account.
     *
     * @param disputeId  The ID of the dispute you want to accept.
     * @return Response from the API call
     */
    async acceptDispute(disputeId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({ disputeId: [disputeId, string()] });
        req.appendTemplatePath `/v2/disputes/${mapped.disputeId}/accept`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(acceptDisputeResponseSchema, requestOptions);
    }
    /**
     * Returns a list of evidence associated with a dispute.
     *
     * @param disputeId  The ID of the dispute.
     * @param cursor     A pagination cursor returned by a previous call to this endpoint. Provide this cursor
     *                             to retrieve the next set of results for the original query. For more information, see
     *                             [Pagination](https://developer.squareup.com/docs/build-basics/common-api-
     *                             patterns/pagination).
     * @return Response from the API call
     */
    async listDisputeEvidence(disputeId, cursor, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            disputeId: [disputeId, string()],
            cursor: [cursor, optional(string())],
        });
        req.query('cursor', mapped.cursor);
        req.appendTemplatePath `/v2/disputes/${mapped.disputeId}/evidence`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(listDisputeEvidenceResponseSchema, requestOptions);
    }
    /**
     * Uploads a file to use as evidence in a dispute challenge. The endpoint accepts HTTP
     * multipart/form-data file uploads in HEIC, HEIF, JPEG, PDF, PNG, and TIFF formats.
     *
     * @param disputeId  The ID of the dispute for which you want to upload
     *                                                              evidence.
     * @param request    Defines the parameters for a
     *                                                              `CreateDisputeEvidenceFile` request.
     * @param imageFile
     * @return Response from the API call
     */
    async createDisputeEvidenceFile(disputeId, request, imageFile, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            disputeId: [disputeId, string()],
            request: [request, optional(createDisputeEvidenceFileRequestSchema)],
        });
        req.formData({
            request: JSON.stringify(mapped.request),
            image_file: imageFile,
        });
        req.appendTemplatePath `/v2/disputes/${mapped.disputeId}/evidence-files`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(createDisputeEvidenceFileResponseSchema, requestOptions);
    }
    /**
     * Uploads text to use as evidence for a dispute challenge.
     *
     * @param disputeId    The ID of the dispute for which you want to upload
     *                                                                evidence.
     * @param body         An object containing the fields to POST for the
     *                                                                request.  See the corresponding object definition
     *                                                                for field details.
     * @return Response from the API call
     */
    async createDisputeEvidenceText(disputeId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            disputeId: [disputeId, string()],
            body: [body, createDisputeEvidenceTextRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/disputes/${mapped.disputeId}/evidence-text`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(createDisputeEvidenceTextResponseSchema, requestOptions);
    }
    /**
     * Removes specified evidence from a dispute.
     * Square does not send the bank any evidence that is removed.
     *
     * @param disputeId   The ID of the dispute from which you want to remove evidence.
     * @param evidenceId  The ID of the evidence you want to remove.
     * @return Response from the API call
     */
    async deleteDisputeEvidence(disputeId, evidenceId, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            disputeId: [disputeId, string()],
            evidenceId: [evidenceId, string()],
        });
        req.appendTemplatePath `/v2/disputes/${mapped.disputeId}/evidence/${mapped.evidenceId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteDisputeEvidenceResponseSchema, requestOptions);
    }
    /**
     * Returns the metadata for the evidence specified in the request URL path.
     *
     * You must maintain a copy of any evidence uploaded if you want to reference it later. Evidence cannot
     * be downloaded after you upload it.
     *
     * @param disputeId   The ID of the dispute from which you want to retrieve evidence metadata.
     * @param evidenceId  The ID of the evidence to retrieve.
     * @return Response from the API call
     */
    async retrieveDisputeEvidence(disputeId, evidenceId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            disputeId: [disputeId, string()],
            evidenceId: [evidenceId, string()],
        });
        req.appendTemplatePath `/v2/disputes/${mapped.disputeId}/evidence/${mapped.evidenceId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveDisputeEvidenceResponseSchema, requestOptions);
    }
    /**
     * Submits evidence to the cardholder's bank.
     *
     * The evidence submitted by this endpoint includes evidence uploaded
     * using the [CreateDisputeEvidenceFile]($e/Disputes/CreateDisputeEvidenceFile) and
     * [CreateDisputeEvidenceText]($e/Disputes/CreateDisputeEvidenceText) endpoints and
     * evidence automatically provided by Square, when available. Evidence cannot be removed from
     * a dispute after submission.
     *
     * @param disputeId  The ID of the dispute for which you want to submit evidence.
     * @return Response from the API call
     */
    async submitEvidence(disputeId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({ disputeId: [disputeId, string()] });
        req.appendTemplatePath `/v2/disputes/${mapped.disputeId}/submit-evidence`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(submitEvidenceResponseSchema, requestOptions);
    }
}

const employeeSchema = object({
    id: ['id', optional(string())],
    firstName: ['first_name', optional(nullable(string()))],
    lastName: ['last_name', optional(nullable(string()))],
    email: ['email', optional(nullable(string()))],
    phoneNumber: ['phone_number', optional(nullable(string()))],
    locationIds: ['location_ids', optional(nullable(array(string())))],
    status: ['status', optional(string())],
    isOwner: ['is_owner', optional(nullable(boolean()))],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
});

const listEmployeesResponseSchema = object({
    employees: ['employees', optional(array(lazy(() => employeeSchema)))],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveEmployeeResponseSchema = object({
    employee: ['employee', optional(lazy(() => employeeSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class EmployeesApi extends BaseApi {
    /**
     * @param locationId
     * @param status      Specifies the EmployeeStatus to filter the employee by.
     * @param limit       The number of employees to be returned on each page.
     * @param cursor      The token required to retrieve the specified page of results.
     * @return Response from the API call
     * @deprecated
     */
    async listEmployees(locationId, status, limit, cursor, requestOptions) {
        const req = this.createRequest('GET', '/v2/employees');
        const mapped = req.prepareArgs({
            locationId: [locationId, optional(string())],
            status: [status, optional(string())],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
        });
        req.query('location_id', mapped.locationId);
        req.query('status', mapped.status);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.deprecated('EmployeesApi.listEmployees');
        req.authenticate([{ global: true }]);
        return req.callAsJson(listEmployeesResponseSchema, requestOptions);
    }
    /**
     * @param id UUID for the employee that was requested.
     * @return Response from the API call
     * @deprecated
     */
    async retrieveEmployee(id, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ id: [id, string()] });
        req.appendTemplatePath `/v2/employees/${mapped.id}`;
        req.deprecated('EmployeesApi.retrieveEmployee');
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveEmployeeResponseSchema, requestOptions);
    }
}

const disableEventsResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const enableEventsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const eventTypeMetadataSchema = object({
    eventType: ['event_type', optional(string())],
    apiVersionIntroduced: ['api_version_introduced', optional(string())],
    releaseStatus: ['release_status', optional(string())],
});

const listEventTypesResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    eventTypes: ['event_types', optional(array(string()))],
    metadata: [
        'metadata',
        optional(array(lazy(() => eventTypeMetadataSchema))),
    ],
});

const searchEventsFilterSchema = object({
    eventTypes: ['event_types', optional(nullable(array(string())))],
    merchantIds: ['merchant_ids', optional(nullable(array(string())))],
    locationIds: ['location_ids', optional(nullable(array(string())))],
    createdAt: ['created_at', optional(lazy(() => timeRangeSchema))],
});

const searchEventsSortSchema = object({
    field: ['field', optional(string())],
    order: ['order', optional(string())],
});

const searchEventsQuerySchema = object({
    filter: ['filter', optional(lazy(() => searchEventsFilterSchema))],
    sort: ['sort', optional(lazy(() => searchEventsSortSchema))],
});

const searchEventsRequestSchema = object({
    cursor: ['cursor', optional(string())],
    limit: ['limit', optional(number())],
    query: ['query', optional(lazy(() => searchEventsQuerySchema))],
});

const eventDataSchema = object({
    type: ['type', optional(nullable(string()))],
    id: ['id', optional(string())],
    deleted: ['deleted', optional(nullable(boolean()))],
    object: ['object', optional(nullable(dict(unknown())))],
});

const eventSchema = object({
    merchantId: ['merchant_id', optional(nullable(string()))],
    locationId: ['location_id', optional(nullable(string()))],
    type: ['type', optional(nullable(string()))],
    eventId: ['event_id', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
    data: ['data', optional(lazy(() => eventDataSchema))],
});

const eventMetadataSchema = object({
    eventId: ['event_id', optional(nullable(string()))],
    apiVersion: ['api_version', optional(nullable(string()))],
});

const searchEventsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    events: ['events', optional(array(lazy(() => eventSchema)))],
    metadata: ['metadata', optional(array(lazy(() => eventMetadataSchema)))],
    cursor: ['cursor', optional(string())],
});

class EventsApi extends BaseApi {
    /**
     * Search for Square API events that occur within a 28-day timeframe.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                   the corresponding object definition for field details.
     * @return Response from the API call
     */
    async searchEvents(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/events');
        const mapped = req.prepareArgs({ body: [body, searchEventsRequestSchema] });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchEventsResponseSchema, requestOptions);
    }
    /**
     * Disables events to prevent them from being searchable.
     * All events are disabled by default. You must enable events to make them searchable.
     * Disabling events for a specific time period prevents them from being searchable, even if you re-
     * enable them later.
     *
     * @return Response from the API call
     */
    async disableEvents(requestOptions) {
        const req = this.createRequest('PUT', '/v2/events/disable');
        req.authenticate([{ global: true }]);
        return req.callAsJson(disableEventsResponseSchema, requestOptions);
    }
    /**
     * Enables events to make them searchable. Only events that occur while in the enabled state are
     * searchable.
     *
     * @return Response from the API call
     */
    async enableEvents(requestOptions) {
        const req = this.createRequest('PUT', '/v2/events/enable');
        req.authenticate([{ global: true }]);
        return req.callAsJson(enableEventsResponseSchema, requestOptions);
    }
    /**
     * Lists all event types that you can subscribe to as webhooks or query using the Events API.
     *
     * @param apiVersion  The API version for which to list event types. Setting this field overrides the
     *                              default version used by the application.
     * @return Response from the API call
     */
    async listEventTypes(apiVersion, requestOptions) {
        const req = this.createRequest('GET', '/v2/events/types');
        const mapped = req.prepareArgs({
            apiVersion: [apiVersion, optional(string())],
        });
        req.query('api_version', mapped.apiVersion);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listEventTypesResponseSchema, requestOptions);
    }
}

const giftCardActivityActivateSchema = object({
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    orderId: ['order_id', optional(nullable(string()))],
    lineItemUid: ['line_item_uid', optional(nullable(string()))],
    referenceId: ['reference_id', optional(nullable(string()))],
    buyerPaymentInstrumentIds: [
        'buyer_payment_instrument_ids',
        optional(nullable(array(string()))),
    ],
});

const giftCardActivityAdjustDecrementSchema = object({
    amountMoney: ['amount_money', lazy(() => moneySchema)],
    reason: ['reason', string()],
});

const giftCardActivityAdjustIncrementSchema = object({
    amountMoney: ['amount_money', lazy(() => moneySchema)],
    reason: ['reason', string()],
});

const giftCardActivityBlockSchema = object({ reason: ['reason', string()] });

const giftCardActivityClearBalanceSchema = object({ reason: ['reason', string()] });

const giftCardActivityDeactivateSchema = object({ reason: ['reason', string()] });

const giftCardActivityImportSchema = object({ amountMoney: ['amount_money', lazy(() => moneySchema)] });

const giftCardActivityImportReversalSchema = object({ amountMoney: ['amount_money', lazy(() => moneySchema)] });

const giftCardActivityLoadSchema = object({
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    orderId: ['order_id', optional(nullable(string()))],
    lineItemUid: ['line_item_uid', optional(nullable(string()))],
    referenceId: ['reference_id', optional(nullable(string()))],
    buyerPaymentInstrumentIds: [
        'buyer_payment_instrument_ids',
        optional(nullable(array(string()))),
    ],
});

const giftCardActivityRedeemSchema = object({
    amountMoney: ['amount_money', lazy(() => moneySchema)],
    paymentId: ['payment_id', optional(string())],
    referenceId: ['reference_id', optional(nullable(string()))],
    status: ['status', optional(string())],
});

const giftCardActivityRefundSchema = object({
    redeemActivityId: ['redeem_activity_id', optional(nullable(string()))],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    referenceId: ['reference_id', optional(nullable(string()))],
    paymentId: ['payment_id', optional(string())],
});

const giftCardActivityTransferBalanceFromSchema = object({
    transferToGiftCardId: ['transfer_to_gift_card_id', string()],
    amountMoney: ['amount_money', lazy(() => moneySchema)],
});

const giftCardActivityTransferBalanceToSchema = object({
    transferFromGiftCardId: ['transfer_from_gift_card_id', string()],
    amountMoney: ['amount_money', lazy(() => moneySchema)],
});

const giftCardActivityUnblockSchema = object({ reason: ['reason', string()] });

const giftCardActivityUnlinkedActivityRefundSchema = object({
    amountMoney: ['amount_money', lazy(() => moneySchema)],
    referenceId: ['reference_id', optional(nullable(string()))],
    paymentId: ['payment_id', optional(string())],
});

const giftCardActivitySchema = object({
    id: ['id', optional(string())],
    type: ['type', string()],
    locationId: ['location_id', string()],
    createdAt: ['created_at', optional(string())],
    giftCardId: ['gift_card_id', optional(nullable(string()))],
    giftCardGan: ['gift_card_gan', optional(nullable(string()))],
    giftCardBalanceMoney: [
        'gift_card_balance_money',
        optional(lazy(() => moneySchema)),
    ],
    loadActivityDetails: [
        'load_activity_details',
        optional(lazy(() => giftCardActivityLoadSchema)),
    ],
    activateActivityDetails: [
        'activate_activity_details',
        optional(lazy(() => giftCardActivityActivateSchema)),
    ],
    redeemActivityDetails: [
        'redeem_activity_details',
        optional(lazy(() => giftCardActivityRedeemSchema)),
    ],
    clearBalanceActivityDetails: [
        'clear_balance_activity_details',
        optional(lazy(() => giftCardActivityClearBalanceSchema)),
    ],
    deactivateActivityDetails: [
        'deactivate_activity_details',
        optional(lazy(() => giftCardActivityDeactivateSchema)),
    ],
    adjustIncrementActivityDetails: [
        'adjust_increment_activity_details',
        optional(lazy(() => giftCardActivityAdjustIncrementSchema)),
    ],
    adjustDecrementActivityDetails: [
        'adjust_decrement_activity_details',
        optional(lazy(() => giftCardActivityAdjustDecrementSchema)),
    ],
    refundActivityDetails: [
        'refund_activity_details',
        optional(lazy(() => giftCardActivityRefundSchema)),
    ],
    unlinkedActivityRefundActivityDetails: [
        'unlinked_activity_refund_activity_details',
        optional(lazy(() => giftCardActivityUnlinkedActivityRefundSchema)),
    ],
    importActivityDetails: [
        'import_activity_details',
        optional(lazy(() => giftCardActivityImportSchema)),
    ],
    blockActivityDetails: [
        'block_activity_details',
        optional(lazy(() => giftCardActivityBlockSchema)),
    ],
    unblockActivityDetails: [
        'unblock_activity_details',
        optional(lazy(() => giftCardActivityUnblockSchema)),
    ],
    importReversalActivityDetails: [
        'import_reversal_activity_details',
        optional(lazy(() => giftCardActivityImportReversalSchema)),
    ],
    transferBalanceToActivityDetails: [
        'transfer_balance_to_activity_details',
        optional(lazy(() => giftCardActivityTransferBalanceToSchema)),
    ],
    transferBalanceFromActivityDetails: [
        'transfer_balance_from_activity_details',
        optional(lazy(() => giftCardActivityTransferBalanceFromSchema)),
    ],
});

const createGiftCardActivityRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    giftCardActivity: [
        'gift_card_activity',
        lazy(() => giftCardActivitySchema),
    ],
});

const createGiftCardActivityResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    giftCardActivity: [
        'gift_card_activity',
        optional(lazy(() => giftCardActivitySchema)),
    ],
});

const listGiftCardActivitiesResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    giftCardActivities: [
        'gift_card_activities',
        optional(array(lazy(() => giftCardActivitySchema))),
    ],
    cursor: ['cursor', optional(string())],
});

class GiftCardActivitiesApi extends BaseApi {
    /**
     * Lists gift card activities. By default, you get gift card activities for all
     * gift cards in the seller's account. You can optionally specify query parameters to
     * filter the list. For example, you can get a list of gift card activities for a gift card,
     * for all gift cards in a specific region, or for activities within a time window.
     *
     * @param giftCardId   If a gift card ID is provided, the endpoint returns activities related  to the
     *                               specified gift card. Otherwise, the endpoint returns all gift card activities for
     *                               the seller.
     * @param type         If a [type](entity:GiftCardActivityType) is provided, the endpoint returns gift
     *                               card activities of the specified type.  Otherwise, the endpoint returns all types of
     *                               gift card activities.
     * @param locationId   If a location ID is provided, the endpoint returns gift card activities for the
     *                               specified location.  Otherwise, the endpoint returns gift card activities for all
     *                               locations.
     * @param beginTime    The timestamp for the beginning of the reporting period, in RFC 3339 format. This
     *                               start time is inclusive. The default value is the current time minus one year.
     * @param endTime      The timestamp for the end of the reporting period, in RFC 3339 format. This end
     *                               time is inclusive. The default value is the current time.
     * @param limit        If a limit is provided, the endpoint returns the specified number  of results (or
     *                               fewer) per page. The maximum value is 100. The default value is 50. For more
     *                               information, see [Pagination](https://developer.squareup.com/docs/working-with-
     *                               apis/pagination).
     * @param cursor       A pagination cursor returned by a previous call to this endpoint. Provide this
     *                               cursor to retrieve the next set of results for the original query. If a cursor is
     *                               not provided, the endpoint returns the first page of the results. For more
     *                               information, see [Pagination](https://developer.squareup.com/docs/working-with-
     *                               apis/pagination).
     * @param sortOrder    The order in which the endpoint returns the activities, based on `created_at`. -
     *                               `ASC` - Oldest to newest. - `DESC` - Newest to oldest (default).
     * @return Response from the API call
     */
    async listGiftCardActivities(giftCardId, type, locationId, beginTime, endTime, limit, cursor, sortOrder, requestOptions) {
        const req = this.createRequest('GET', '/v2/gift-cards/activities');
        const mapped = req.prepareArgs({
            giftCardId: [giftCardId, optional(string())],
            type: [type, optional(string())],
            locationId: [locationId, optional(string())],
            beginTime: [beginTime, optional(string())],
            endTime: [endTime, optional(string())],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
            sortOrder: [sortOrder, optional(string())],
        });
        req.query('gift_card_id', mapped.giftCardId);
        req.query('type', mapped.type);
        req.query('location_id', mapped.locationId);
        req.query('begin_time', mapped.beginTime);
        req.query('end_time', mapped.endTime);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.query('sort_order', mapped.sortOrder);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listGiftCardActivitiesResponseSchema, requestOptions);
    }
    /**
     * Creates a gift card activity to manage the balance or state of a [gift card]($m/GiftCard).
     * For example, create an `ACTIVATE` activity to activate a gift card with an initial balance before
     * first use.
     *
     * @param body         An object containing the fields to POST for the
     *                                                             request.  See the corresponding object definition for
     *                                                             field details.
     * @return Response from the API call
     */
    async createGiftCardActivity(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/gift-cards/activities');
        const mapped = req.prepareArgs({
            body: [body, createGiftCardActivityRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createGiftCardActivityResponseSchema, requestOptions);
    }
}

const giftCardSchema = object({
    id: ['id', optional(string())],
    type: ['type', string()],
    ganSource: ['gan_source', optional(string())],
    state: ['state', optional(string())],
    balanceMoney: ['balance_money', optional(lazy(() => moneySchema))],
    gan: ['gan', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
    customerIds: ['customer_ids', optional(array(string()))],
});

const createGiftCardRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    locationId: ['location_id', string()],
    giftCard: ['gift_card', lazy(() => giftCardSchema)],
});

const createGiftCardResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    giftCard: ['gift_card', optional(lazy(() => giftCardSchema))],
});

const linkCustomerToGiftCardRequestSchema = object({ customerId: ['customer_id', string()] });

const linkCustomerToGiftCardResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    giftCard: ['gift_card', optional(lazy(() => giftCardSchema))],
});

const listGiftCardsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    giftCards: ['gift_cards', optional(array(lazy(() => giftCardSchema)))],
    cursor: ['cursor', optional(string())],
});

const retrieveGiftCardFromGANRequestSchema = object({ gan: ['gan', string()] });

const retrieveGiftCardFromGANResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    giftCard: ['gift_card', optional(lazy(() => giftCardSchema))],
});

const retrieveGiftCardFromNonceRequestSchema = object({ nonce: ['nonce', string()] });

const retrieveGiftCardFromNonceResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    giftCard: ['gift_card', optional(lazy(() => giftCardSchema))],
});

const retrieveGiftCardResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    giftCard: ['gift_card', optional(lazy(() => giftCardSchema))],
});

const unlinkCustomerFromGiftCardRequestSchema = object({ customerId: ['customer_id', string()] });

const unlinkCustomerFromGiftCardResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    giftCard: ['gift_card', optional(lazy(() => giftCardSchema))],
});

class GiftCardsApi extends BaseApi {
    /**
     * Lists all gift cards. You can specify optional filters to retrieve
     * a subset of the gift cards. Results are sorted by `created_at` in ascending order.
     *
     * @param type        If a [type](entity:GiftCardType) is provided, the endpoint returns gift cards of the
     *                              specified type. Otherwise, the endpoint returns gift cards of all types.
     * @param state       If a [state](entity:GiftCardStatus) is provided, the endpoint returns the gift cards
     *                              in the specified state. Otherwise, the endpoint returns the gift cards of all states.
     * @param limit       If a limit is provided, the endpoint returns only the specified number of results
     *                              per page. The maximum value is 200. The default value is 30. For more information,
     *                              see [Pagination](https://developer.squareup.com/docs/working-with-apis/pagination).
     * @param cursor      A pagination cursor returned by a previous call to this endpoint. Provide this
     *                              cursor to retrieve the next set of results for the original query. If a cursor is not
     *                              provided, the endpoint returns the first page of the results.  For more information,
     *                              see [Pagination](https://developer.squareup.com/docs/working-with-apis/pagination).
     * @param customerId  If a customer ID is provided, the endpoint returns only the gift cards linked to the
     *                              specified customer.
     * @return Response from the API call
     */
    async listGiftCards(type, state, limit, cursor, customerId, requestOptions) {
        const req = this.createRequest('GET', '/v2/gift-cards');
        const mapped = req.prepareArgs({
            type: [type, optional(string())],
            state: [state, optional(string())],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
            customerId: [customerId, optional(string())],
        });
        req.query('type', mapped.type);
        req.query('state', mapped.state);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.query('customer_id', mapped.customerId);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listGiftCardsResponseSchema, requestOptions);
    }
    /**
     * Creates a digital gift card or registers a physical (plastic) gift card. The resulting gift card
     * has a `PENDING` state. To activate a gift card so that it can be redeemed for purchases, call
     * [CreateGiftCardActivity]($e/GiftCardActivities/CreateGiftCardActivity) and create an `ACTIVATE`
     * activity with the initial balance. Alternatively, you can use
     * [RefundPayment]($e/Refunds/RefundPayment)
     * to refund a payment to the new gift card.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                     the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createGiftCard(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/gift-cards');
        const mapped = req.prepareArgs({
            body: [body, createGiftCardRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createGiftCardResponseSchema, requestOptions);
    }
    /**
     * Retrieves a gift card using the gift card account number (GAN).
     *
     * @param body         An object containing the fields to POST for the
     *                                                              request.  See the corresponding object definition for
     *                                                              field details.
     * @return Response from the API call
     */
    async retrieveGiftCardFromGAN(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/gift-cards/from-gan');
        const mapped = req.prepareArgs({
            body: [body, retrieveGiftCardFromGANRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveGiftCardFromGANResponseSchema, requestOptions);
    }
    /**
     * Retrieves a gift card using a secure payment token that represents the gift card.
     *
     * @param body         An object containing the fields to POST for the
     *                                                                request.  See the corresponding object definition
     *                                                                for field details.
     * @return Response from the API call
     */
    async retrieveGiftCardFromNonce(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/gift-cards/from-nonce');
        const mapped = req.prepareArgs({
            body: [body, retrieveGiftCardFromNonceRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveGiftCardFromNonceResponseSchema, requestOptions);
    }
    /**
     * Links a customer to a gift card, which is also referred to as adding a card on file.
     *
     * @param giftCardId   The ID of the gift card to be linked.
     * @param body         An object containing the fields to POST for the
     *                                                             request.  See the corresponding object definition for
     *                                                             field details.
     * @return Response from the API call
     */
    async linkCustomerToGiftCard(giftCardId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            giftCardId: [giftCardId, string()],
            body: [body, linkCustomerToGiftCardRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/gift-cards/${mapped.giftCardId}/link-customer`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(linkCustomerToGiftCardResponseSchema, requestOptions);
    }
    /**
     * Unlinks a customer from a gift card, which is also referred to as removing a card on file.
     *
     * @param giftCardId   The ID of the gift card to be unlinked.
     * @param body         An object containing the fields to POST for the
     *                                                                 request.  See the corresponding object definition
     *                                                                 for field details.
     * @return Response from the API call
     */
    async unlinkCustomerFromGiftCard(giftCardId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            giftCardId: [giftCardId, string()],
            body: [body, unlinkCustomerFromGiftCardRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/gift-cards/${mapped.giftCardId}/unlink-customer`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(unlinkCustomerFromGiftCardResponseSchema, requestOptions);
    }
    /**
     * Retrieves a gift card using the gift card ID.
     *
     * @param id The ID of the gift card to retrieve.
     * @return Response from the API call
     */
    async retrieveGiftCard(id, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ id: [id, string()] });
        req.appendTemplatePath `/v2/gift-cards/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveGiftCardResponseSchema, requestOptions);
    }
}

const inventoryAdjustmentGroupSchema = object({
    id: ['id', optional(string())],
    rootAdjustmentId: ['root_adjustment_id', optional(string())],
    fromState: ['from_state', optional(string())],
    toState: ['to_state', optional(string())],
});

const inventoryAdjustmentSchema = object({
    id: ['id', optional(string())],
    referenceId: ['reference_id', optional(nullable(string()))],
    fromState: ['from_state', optional(string())],
    toState: ['to_state', optional(string())],
    locationId: ['location_id', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogObjectType: ['catalog_object_type', optional(nullable(string()))],
    quantity: ['quantity', optional(nullable(string()))],
    totalPriceMoney: ['total_price_money', optional(lazy(() => moneySchema))],
    occurredAt: ['occurred_at', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
    source: ['source', optional(lazy(() => sourceApplicationSchema))],
    employeeId: ['employee_id', optional(nullable(string()))],
    teamMemberId: ['team_member_id', optional(nullable(string()))],
    transactionId: ['transaction_id', optional(string())],
    refundId: ['refund_id', optional(string())],
    purchaseOrderId: ['purchase_order_id', optional(string())],
    goodsReceiptId: ['goods_receipt_id', optional(string())],
    adjustmentGroup: [
        'adjustment_group',
        optional(lazy(() => inventoryAdjustmentGroupSchema)),
    ],
});

const inventoryPhysicalCountSchema = object({
    id: ['id', optional(string())],
    referenceId: ['reference_id', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogObjectType: ['catalog_object_type', optional(nullable(string()))],
    state: ['state', optional(string())],
    locationId: ['location_id', optional(nullable(string()))],
    quantity: ['quantity', optional(nullable(string()))],
    source: ['source', optional(lazy(() => sourceApplicationSchema))],
    employeeId: ['employee_id', optional(nullable(string()))],
    teamMemberId: ['team_member_id', optional(nullable(string()))],
    occurredAt: ['occurred_at', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
});

const inventoryTransferSchema = object({
    id: ['id', optional(string())],
    referenceId: ['reference_id', optional(nullable(string()))],
    state: ['state', optional(string())],
    fromLocationId: ['from_location_id', optional(nullable(string()))],
    toLocationId: ['to_location_id', optional(nullable(string()))],
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogObjectType: ['catalog_object_type', optional(nullable(string()))],
    quantity: ['quantity', optional(nullable(string()))],
    occurredAt: ['occurred_at', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
    source: ['source', optional(lazy(() => sourceApplicationSchema))],
    employeeId: ['employee_id', optional(nullable(string()))],
    teamMemberId: ['team_member_id', optional(nullable(string()))],
});

const inventoryChangeSchema = object({
    type: ['type', optional(string())],
    physicalCount: [
        'physical_count',
        optional(lazy(() => inventoryPhysicalCountSchema)),
    ],
    adjustment: ['adjustment', optional(lazy(() => inventoryAdjustmentSchema))],
    transfer: ['transfer', optional(lazy(() => inventoryTransferSchema))],
    measurementUnit: [
        'measurement_unit',
        optional(lazy(() => catalogMeasurementUnitSchema)),
    ],
    measurementUnitId: ['measurement_unit_id', optional(string())],
});

const batchChangeInventoryRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    changes: [
        'changes',
        optional(nullable(array(lazy(() => inventoryChangeSchema)))),
    ],
    ignoreUnchangedCounts: [
        'ignore_unchanged_counts',
        optional(nullable(boolean())),
    ],
});

const inventoryCountSchema = object({
    catalogObjectId: ['catalog_object_id', optional(nullable(string()))],
    catalogObjectType: ['catalog_object_type', optional(nullable(string()))],
    state: ['state', optional(string())],
    locationId: ['location_id', optional(nullable(string()))],
    quantity: ['quantity', optional(nullable(string()))],
    calculatedAt: ['calculated_at', optional(string())],
    isEstimated: ['is_estimated', optional(boolean())],
});

const batchChangeInventoryResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    counts: ['counts', optional(array(lazy(() => inventoryCountSchema)))],
    changes: ['changes', optional(array(lazy(() => inventoryChangeSchema)))],
});

const batchRetrieveInventoryChangesRequestSchema = object({
    catalogObjectIds: [
        'catalog_object_ids',
        optional(nullable(array(string()))),
    ],
    locationIds: ['location_ids', optional(nullable(array(string())))],
    types: ['types', optional(nullable(array(string())))],
    states: ['states', optional(nullable(array(string())))],
    updatedAfter: ['updated_after', optional(nullable(string()))],
    updatedBefore: ['updated_before', optional(nullable(string()))],
    cursor: ['cursor', optional(nullable(string()))],
    limit: ['limit', optional(nullable(number()))],
});

const batchRetrieveInventoryChangesResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    changes: ['changes', optional(array(lazy(() => inventoryChangeSchema)))],
    cursor: ['cursor', optional(string())],
});

const batchRetrieveInventoryCountsRequestSchema = object({
    catalogObjectIds: [
        'catalog_object_ids',
        optional(nullable(array(string()))),
    ],
    locationIds: ['location_ids', optional(nullable(array(string())))],
    updatedAfter: ['updated_after', optional(nullable(string()))],
    cursor: ['cursor', optional(nullable(string()))],
    states: ['states', optional(nullable(array(string())))],
    limit: ['limit', optional(nullable(number()))],
});

const batchRetrieveInventoryCountsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    counts: ['counts', optional(array(lazy(() => inventoryCountSchema)))],
    cursor: ['cursor', optional(string())],
});

const retrieveInventoryAdjustmentResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    adjustment: ['adjustment', optional(lazy(() => inventoryAdjustmentSchema))],
});

const retrieveInventoryChangesResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    changes: ['changes', optional(array(lazy(() => inventoryChangeSchema)))],
    cursor: ['cursor', optional(string())],
});

const retrieveInventoryCountResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    counts: ['counts', optional(array(lazy(() => inventoryCountSchema)))],
    cursor: ['cursor', optional(string())],
});

const retrieveInventoryPhysicalCountResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    count: ['count', optional(lazy(() => inventoryPhysicalCountSchema))],
});

const retrieveInventoryTransferResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    transfer: ['transfer', optional(lazy(() => inventoryTransferSchema))],
});

class InventoryApi extends BaseApi {
    /**
     * Deprecated version of [RetrieveInventoryAdjustment](api-endpoint:Inventory-
     * RetrieveInventoryAdjustment) after the endpoint URL
     * is updated to conform to the standard convention.
     *
     * @param adjustmentId  ID of the [InventoryAdjustment](entity:InventoryAdjustment) to retrieve.
     * @return Response from the API call
     * @deprecated
     */
    async deprecatedRetrieveInventoryAdjustment(adjustmentId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ adjustmentId: [adjustmentId, string()] });
        req.appendTemplatePath `/v2/inventory/adjustment/${mapped.adjustmentId}`;
        req.deprecated('InventoryApi.deprecatedRetrieveInventoryAdjustment');
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveInventoryAdjustmentResponseSchema, requestOptions);
    }
    /**
     * Returns the [InventoryAdjustment]($m/InventoryAdjustment) object
     * with the provided `adjustment_id`.
     *
     * @param adjustmentId  ID of the [InventoryAdjustment](entity:InventoryAdjustment) to retrieve.
     * @return Response from the API call
     */
    async retrieveInventoryAdjustment(adjustmentId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ adjustmentId: [adjustmentId, string()] });
        req.appendTemplatePath `/v2/inventory/adjustments/${mapped.adjustmentId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveInventoryAdjustmentResponseSchema, requestOptions);
    }
    /**
     * Deprecated version of [BatchChangeInventory](api-endpoint:Inventory-BatchChangeInventory) after the
     * endpoint URL
     * is updated to conform to the standard convention.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                           See the corresponding object definition for field
     *                                                           details.
     * @return Response from the API call
     * @deprecated
     */
    async deprecatedBatchChangeInventory(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/inventory/batch-change');
        const mapped = req.prepareArgs({
            body: [body, batchChangeInventoryRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.deprecated('InventoryApi.deprecatedBatchChangeInventory');
        req.authenticate([{ global: true }]);
        return req.callAsJson(batchChangeInventoryResponseSchema, requestOptions);
    }
    /**
     * Deprecated version of [BatchRetrieveInventoryChanges](api-endpoint:Inventory-
     * BatchRetrieveInventoryChanges) after the endpoint URL
     * is updated to conform to the standard convention.
     *
     * @param body         An object containing the fields to POST for
     *                                                                    the request.  See the corresponding object
     *                                                                    definition for field details.
     * @return Response from the API call
     * @deprecated
     */
    async deprecatedBatchRetrieveInventoryChanges(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/inventory/batch-retrieve-changes');
        const mapped = req.prepareArgs({
            body: [body, batchRetrieveInventoryChangesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.deprecated('InventoryApi.deprecatedBatchRetrieveInventoryChanges');
        req.authenticate([{ global: true }]);
        return req.callAsJson(batchRetrieveInventoryChangesResponseSchema, requestOptions);
    }
    /**
     * Deprecated version of [BatchRetrieveInventoryCounts](api-endpoint:Inventory-
     * BatchRetrieveInventoryCounts) after the endpoint URL
     * is updated to conform to the standard convention.
     *
     * @param body         An object containing the fields to POST for the
     *                                                                   request.  See the corresponding object
     *                                                                   definition for field details.
     * @return Response from the API call
     * @deprecated
     */
    async deprecatedBatchRetrieveInventoryCounts(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/inventory/batch-retrieve-counts');
        const mapped = req.prepareArgs({
            body: [body, batchRetrieveInventoryCountsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.deprecated('InventoryApi.deprecatedBatchRetrieveInventoryCounts');
        req.authenticate([{ global: true }]);
        return req.callAsJson(batchRetrieveInventoryCountsResponseSchema, requestOptions);
    }
    /**
     * Applies adjustments and counts to the provided item quantities.
     *
     * On success: returns the current calculated counts for all objects
     * referenced in the request.
     * On failure: returns a list of related errors.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                           See the corresponding object definition for field
     *                                                           details.
     * @return Response from the API call
     */
    async batchChangeInventory(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/inventory/changes/batch-create');
        const mapped = req.prepareArgs({
            body: [body, batchChangeInventoryRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(batchChangeInventoryResponseSchema, requestOptions);
    }
    /**
     * Returns historical physical counts and adjustments based on the
     * provided filter criteria.
     *
     * Results are paginated and sorted in ascending order according their
     * `occurred_at` timestamp (oldest first).
     *
     * BatchRetrieveInventoryChanges is a catch-all query endpoint for queries
     * that cannot be handled by other, simpler endpoints.
     *
     * @param body         An object containing the fields to POST for
     *                                                                    the request.  See the corresponding object
     *                                                                    definition for field details.
     * @return Response from the API call
     */
    async batchRetrieveInventoryChanges(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/inventory/changes/batch-retrieve');
        const mapped = req.prepareArgs({
            body: [body, batchRetrieveInventoryChangesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(batchRetrieveInventoryChangesResponseSchema, requestOptions);
    }
    /**
     * Returns current counts for the provided
     * [CatalogObject]($m/CatalogObject)s at the requested
     * [Location]($m/Location)s.
     *
     * Results are paginated and sorted in descending order according to their
     * `calculated_at` timestamp (newest first).
     *
     * When `updated_after` is specified, only counts that have changed since that
     * time (based on the server timestamp for the most recent change) are
     * returned. This allows clients to perform a "sync" operation, for example
     * in response to receiving a Webhook notification.
     *
     * @param body         An object containing the fields to POST for the
     *                                                                   request.  See the corresponding object
     *                                                                   definition for field details.
     * @return Response from the API call
     */
    async batchRetrieveInventoryCounts(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/inventory/counts/batch-retrieve');
        const mapped = req.prepareArgs({
            body: [body, batchRetrieveInventoryCountsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(batchRetrieveInventoryCountsResponseSchema, requestOptions);
    }
    /**
     * Deprecated version of [RetrieveInventoryPhysicalCount](api-endpoint:Inventory-
     * RetrieveInventoryPhysicalCount) after the endpoint URL
     * is updated to conform to the standard convention.
     *
     * @param physicalCountId   ID of the [InventoryPhysicalCount](entity:InventoryPhysicalCount) to retrieve.
     * @return Response from the API call
     * @deprecated
     */
    async deprecatedRetrieveInventoryPhysicalCount(physicalCountId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            physicalCountId: [physicalCountId, string()],
        });
        req.appendTemplatePath `/v2/inventory/physical-count/${mapped.physicalCountId}`;
        req.deprecated('InventoryApi.deprecatedRetrieveInventoryPhysicalCount');
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveInventoryPhysicalCountResponseSchema, requestOptions);
    }
    /**
     * Returns the [InventoryPhysicalCount]($m/InventoryPhysicalCount)
     * object with the provided `physical_count_id`.
     *
     * @param physicalCountId   ID of the [InventoryPhysicalCount](entity:InventoryPhysicalCount) to retrieve.
     * @return Response from the API call
     */
    async retrieveInventoryPhysicalCount(physicalCountId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            physicalCountId: [physicalCountId, string()],
        });
        req.appendTemplatePath `/v2/inventory/physical-counts/${mapped.physicalCountId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveInventoryPhysicalCountResponseSchema, requestOptions);
    }
    /**
     * Returns the [InventoryTransfer]($m/InventoryTransfer) object
     * with the provided `transfer_id`.
     *
     * @param transferId  ID of the [InventoryTransfer](entity:InventoryTransfer) to retrieve.
     * @return Response from the API call
     */
    async retrieveInventoryTransfer(transferId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ transferId: [transferId, string()] });
        req.appendTemplatePath `/v2/inventory/transfers/${mapped.transferId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveInventoryTransferResponseSchema, requestOptions);
    }
    /**
     * Retrieves the current calculated stock count for a given
     * [CatalogObject]($m/CatalogObject) at a given set of
     * [Location]($m/Location)s. Responses are paginated and unsorted.
     * For more sophisticated queries, use a batch endpoint.
     *
     * @param catalogObjectId   ID of the [CatalogObject](entity:CatalogObject) to retrieve.
     * @param locationIds       The [Location](entity:Location) IDs to look up as a comma-separated list. An
     *                                    empty list queries all locations.
     * @param cursor            A pagination cursor returned by a previous call to this endpoint. Provide this
     *                                    to retrieve the next set of results for the original query.  See the
     *                                    [Pagination](https://developer.squareup.com/docs/working-with-apis/pagination)
     *                                    guide for more information.
     * @return Response from the API call
     */
    async retrieveInventoryCount(catalogObjectId, locationIds, cursor, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            catalogObjectId: [catalogObjectId, string()],
            locationIds: [locationIds, optional(string())],
            cursor: [cursor, optional(string())],
        });
        req.query('location_ids', mapped.locationIds);
        req.query('cursor', mapped.cursor);
        req.appendTemplatePath `/v2/inventory/${mapped.catalogObjectId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveInventoryCountResponseSchema, requestOptions);
    }
    /**
     * Returns a set of physical counts and inventory adjustments for the
     * provided [CatalogObject](entity:CatalogObject) at the requested
     * [Location](entity:Location)s.
     *
     * You can achieve the same result by calling [BatchRetrieveInventoryChanges](api-endpoint:Inventory-
     * BatchRetrieveInventoryChanges)
     * and having the `catalog_object_ids` list contain a single element of the `CatalogObject` ID.
     *
     * Results are paginated and sorted in descending order according to their
     * `occurred_at` timestamp (newest first).
     *
     * There are no limits on how far back the caller can page. This endpoint can be
     * used to display recent changes for a specific item. For more
     * sophisticated queries, use a batch endpoint.
     *
     * @param catalogObjectId   ID of the [CatalogObject](entity:CatalogObject) to retrieve.
     * @param locationIds       The [Location](entity:Location) IDs to look up as a comma-separated list. An
     *                                    empty list queries all locations.
     * @param cursor            A pagination cursor returned by a previous call to this endpoint. Provide this
     *                                    to retrieve the next set of results for the original query.  See the
     *                                    [Pagination](https://developer.squareup.com/docs/working-with-apis/pagination)
     *                                    guide for more information.
     * @return Response from the API call
     * @deprecated
     */
    async retrieveInventoryChanges(catalogObjectId, locationIds, cursor, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            catalogObjectId: [catalogObjectId, string()],
            locationIds: [locationIds, optional(string())],
            cursor: [cursor, optional(string())],
        });
        req.query('location_ids', mapped.locationIds);
        req.query('cursor', mapped.cursor);
        req.appendTemplatePath `/v2/inventory/${mapped.catalogObjectId}/changes`;
        req.deprecated('InventoryApi.retrieveInventoryChanges');
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveInventoryChangesResponseSchema, requestOptions);
    }
}

const cancelInvoiceRequestSchema = object({
    version: ['version', number()],
});

const invoiceAcceptedPaymentMethodsSchema = object({
    card: ['card', optional(nullable(boolean()))],
    squareGiftCard: ['square_gift_card', optional(nullable(boolean()))],
    bankAccount: ['bank_account', optional(nullable(boolean()))],
    buyNowPayLater: ['buy_now_pay_later', optional(nullable(boolean()))],
    cashAppPay: ['cash_app_pay', optional(nullable(boolean()))],
});

const invoiceAttachmentSchema = object({
    id: ['id', optional(string())],
    filename: ['filename', optional(string())],
    description: ['description', optional(string())],
    filesize: ['filesize', optional(number())],
    hash: ['hash', optional(string())],
    mimeType: ['mime_type', optional(string())],
    uploadedAt: ['uploaded_at', optional(string())],
});

const invoiceCustomFieldSchema = object({
    label: ['label', optional(nullable(string()))],
    value: ['value', optional(nullable(string()))],
    placement: ['placement', optional(string())],
});

const invoicePaymentReminderSchema = object({
    uid: ['uid', optional(string())],
    relativeScheduledDays: [
        'relative_scheduled_days',
        optional(nullable(number())),
    ],
    message: ['message', optional(nullable(string()))],
    status: ['status', optional(string())],
    sentAt: ['sent_at', optional(string())],
});

const invoicePaymentRequestSchema = object({
    uid: ['uid', optional(nullable(string()))],
    requestMethod: ['request_method', optional(string())],
    requestType: ['request_type', optional(string())],
    dueDate: ['due_date', optional(nullable(string()))],
    fixedAmountRequestedMoney: [
        'fixed_amount_requested_money',
        optional(lazy(() => moneySchema)),
    ],
    percentageRequested: ['percentage_requested', optional(nullable(string()))],
    tippingEnabled: ['tipping_enabled', optional(nullable(boolean()))],
    automaticPaymentSource: ['automatic_payment_source', optional(string())],
    cardId: ['card_id', optional(nullable(string()))],
    reminders: [
        'reminders',
        optional(nullable(array(lazy(() => invoicePaymentReminderSchema)))),
    ],
    computedAmountMoney: [
        'computed_amount_money',
        optional(lazy(() => moneySchema)),
    ],
    totalCompletedAmountMoney: [
        'total_completed_amount_money',
        optional(lazy(() => moneySchema)),
    ],
    roundingAdjustmentIncludedMoney: [
        'rounding_adjustment_included_money',
        optional(lazy(() => moneySchema)),
    ],
});

const invoiceRecipientTaxIdsSchema = object({ euVat: ['eu_vat', optional(string())] });

const invoiceRecipientSchema = object({
    customerId: ['customer_id', optional(nullable(string()))],
    givenName: ['given_name', optional(string())],
    familyName: ['family_name', optional(string())],
    emailAddress: ['email_address', optional(string())],
    address: ['address', optional(lazy(() => addressSchema))],
    phoneNumber: ['phone_number', optional(string())],
    companyName: ['company_name', optional(string())],
    taxIds: ['tax_ids', optional(lazy(() => invoiceRecipientTaxIdsSchema))],
});

const invoiceSchema = object({
    id: ['id', optional(string())],
    version: ['version', optional(number())],
    locationId: ['location_id', optional(nullable(string()))],
    orderId: ['order_id', optional(nullable(string()))],
    primaryRecipient: [
        'primary_recipient',
        optional(lazy(() => invoiceRecipientSchema)),
    ],
    paymentRequests: [
        'payment_requests',
        optional(nullable(array(lazy(() => invoicePaymentRequestSchema)))),
    ],
    deliveryMethod: ['delivery_method', optional(string())],
    invoiceNumber: ['invoice_number', optional(nullable(string()))],
    title: ['title', optional(nullable(string()))],
    description: ['description', optional(nullable(string()))],
    scheduledAt: ['scheduled_at', optional(nullable(string()))],
    publicUrl: ['public_url', optional(string())],
    nextPaymentAmountMoney: [
        'next_payment_amount_money',
        optional(lazy(() => moneySchema)),
    ],
    status: ['status', optional(string())],
    timezone: ['timezone', optional(string())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    acceptedPaymentMethods: [
        'accepted_payment_methods',
        optional(lazy(() => invoiceAcceptedPaymentMethodsSchema)),
    ],
    customFields: [
        'custom_fields',
        optional(nullable(array(lazy(() => invoiceCustomFieldSchema)))),
    ],
    subscriptionId: ['subscription_id', optional(string())],
    saleOrServiceDate: ['sale_or_service_date', optional(nullable(string()))],
    paymentConditions: ['payment_conditions', optional(nullable(string()))],
    storePaymentMethodEnabled: [
        'store_payment_method_enabled',
        optional(nullable(boolean())),
    ],
    attachments: [
        'attachments',
        optional(array(lazy(() => invoiceAttachmentSchema))),
    ],
});

const cancelInvoiceResponseSchema = object({
    invoice: ['invoice', optional(lazy(() => invoiceSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const createInvoiceAttachmentRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(string())],
    description: ['description', optional(string())],
});

const createInvoiceAttachmentResponseSchema = object({
    attachment: ['attachment', optional(lazy(() => invoiceAttachmentSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const createInvoiceRequestSchema = object({
    invoice: ['invoice', lazy(() => invoiceSchema)],
    idempotencyKey: ['idempotency_key', optional(string())],
});

const createInvoiceResponseSchema = object({
    invoice: ['invoice', optional(lazy(() => invoiceSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const deleteInvoiceAttachmentResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const deleteInvoiceResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const getInvoiceResponseSchema = object({
    invoice: ['invoice', optional(lazy(() => invoiceSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const listInvoicesResponseSchema = object({
    invoices: ['invoices', optional(array(lazy(() => invoiceSchema)))],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const publishInvoiceRequestSchema = object({
    version: ['version', number()],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const publishInvoiceResponseSchema = object({
    invoice: ['invoice', optional(lazy(() => invoiceSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const invoiceFilterSchema = object({
    locationIds: ['location_ids', array(string())],
    customerIds: ['customer_ids', optional(nullable(array(string())))],
});

const invoiceSortSchema = object({
    field: ['field', string()],
    order: ['order', optional(string())],
});

const invoiceQuerySchema = object({
    filter: ['filter', lazy(() => invoiceFilterSchema)],
    sort: ['sort', optional(lazy(() => invoiceSortSchema))],
});

const searchInvoicesRequestSchema = object({
    query: ['query', lazy(() => invoiceQuerySchema)],
    limit: ['limit', optional(number())],
    cursor: ['cursor', optional(string())],
});

const searchInvoicesResponseSchema = object({
    invoices: ['invoices', optional(array(lazy(() => invoiceSchema)))],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateInvoiceRequestSchema = object({
    invoice: ['invoice', lazy(() => invoiceSchema)],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
    fieldsToClear: ['fields_to_clear', optional(nullable(array(string())))],
});

const updateInvoiceResponseSchema = object({
    invoice: ['invoice', optional(lazy(() => invoiceSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class InvoicesApi extends BaseApi {
    /**
     * Returns a list of invoices for a given location. The response
     * is paginated. If truncated, the response includes a `cursor` that you
     * use in a subsequent request to retrieve the next set of invoices.
     *
     * @param locationId  The ID of the location for which to list invoices.
     * @param cursor      A pagination cursor returned by a previous call to this endpoint.  Provide this
     *                              cursor to retrieve the next set of results for your original query.  For more
     *                              information, see [Pagination](https://developer.squareup.com/docs/build-basics/common-
     *                              api-patterns/pagination).
     * @param limit       The maximum number of invoices to return (200 is the maximum `limit`).  If not
     *                              provided, the server uses a default limit of 100 invoices.
     * @return Response from the API call
     */
    async listInvoices(locationId, cursor, limit, requestOptions) {
        const req = this.createRequest('GET', '/v2/invoices');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            cursor: [cursor, optional(string())],
            limit: [limit, optional(number())],
        });
        req.query('location_id', mapped.locationId);
        req.query('cursor', mapped.cursor);
        req.query('limit', mapped.limit);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listInvoicesResponseSchema, requestOptions);
    }
    /**
     * Creates a draft [invoice]($m/Invoice)
     * for an order created using the Orders API.
     *
     * A draft invoice remains in your account and no action is taken.
     * You must publish the invoice before Square can process it (send it to the customer's email address
     * or charge the customer’s card on file).
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                    the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createInvoice(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/invoices');
        const mapped = req.prepareArgs({
            body: [body, createInvoiceRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createInvoiceResponseSchema, requestOptions);
    }
    /**
     * Searches for invoices from a location specified in
     * the filter. You can optionally specify customers in the filter for whom to
     * retrieve invoices. In the current implementation, you can only specify one location and
     * optionally one customer.
     *
     * The response is paginated. If truncated, the response includes a `cursor`
     * that you use in a subsequent request to retrieve the next set of invoices.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                     the corresponding object definition for field details.
     * @return Response from the API call
     */
    async searchInvoices(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/invoices/search');
        const mapped = req.prepareArgs({
            body: [body, searchInvoicesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchInvoicesResponseSchema, requestOptions);
    }
    /**
     * Deletes the specified invoice. When an invoice is deleted, the
     * associated order status changes to CANCELED. You can only delete a draft
     * invoice (you cannot delete a published invoice, including one that is scheduled for processing).
     *
     * @param invoiceId  The ID of the invoice to delete.
     * @param version    The version of the [invoice](entity:Invoice) to delete. If you do not know the
     *                             version, you can call [GetInvoice](api-endpoint:Invoices-GetInvoice) or
     *                             [ListInvoices](api-endpoint:Invoices-ListInvoices).
     * @return Response from the API call
     */
    async deleteInvoice(invoiceId, version, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            invoiceId: [invoiceId, string()],
            version: [version, optional(number())],
        });
        req.query('version', mapped.version);
        req.appendTemplatePath `/v2/invoices/${mapped.invoiceId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteInvoiceResponseSchema, requestOptions);
    }
    /**
     * Retrieves an invoice by invoice ID.
     *
     * @param invoiceId  The ID of the invoice to retrieve.
     * @return Response from the API call
     */
    async getInvoice(invoiceId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ invoiceId: [invoiceId, string()] });
        req.appendTemplatePath `/v2/invoices/${mapped.invoiceId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getInvoiceResponseSchema, requestOptions);
    }
    /**
     * Updates an invoice. This endpoint supports sparse updates, so you only need
     * to specify the fields you want to change along with the required `version` field.
     * Some restrictions apply to updating invoices. For example, you cannot change the
     * `order_id` or `location_id` field.
     *
     * @param invoiceId    The ID of the invoice to update.
     * @param body         An object containing the fields to POST for the request.  See
     *                                                    the corresponding object definition for field details.
     * @return Response from the API call
     */
    async updateInvoice(invoiceId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            invoiceId: [invoiceId, string()],
            body: [body, updateInvoiceRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/invoices/${mapped.invoiceId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateInvoiceResponseSchema, requestOptions);
    }
    /**
     * Uploads a file and attaches it to an invoice. This endpoint accepts HTTP multipart/form-data file
     * uploads
     * with a JSON `request` part and a `file` part. The `file` part must be a `readable stream` that
     * contains a file
     * in a supported format: GIF, JPEG, PNG, TIFF, BMP, or PDF.
     *
     * Invoices can have up to 10 attachments with a total file size of 25 MB. Attachments can be added
     * only to invoices
     * in the `DRAFT`, `SCHEDULED`, `UNPAID`, or `PARTIALLY_PAID` state.
     *
     * @param invoiceId  The ID of the [invoice](entity:Invoice) to attach the
     *                                                            file to.
     * @param request    Represents a
     *                                                            [CreateInvoiceAttachment]($e/Invoices/CreateInvoiceAtta
     *                                                            chment) request.
     * @param imageFile
     * @return Response from the API call
     */
    async createInvoiceAttachment(invoiceId, request, imageFile, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            invoiceId: [invoiceId, string()],
            request: [request, optional(createInvoiceAttachmentRequestSchema)],
        });
        req.formData({
            request: JSON.stringify(mapped.request),
            image_file: imageFile,
        });
        req.appendTemplatePath `/v2/invoices/${mapped.invoiceId}/attachments`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(createInvoiceAttachmentResponseSchema, requestOptions);
    }
    /**
     * Removes an attachment from an invoice and permanently deletes the file. Attachments can be removed
     * only
     * from invoices in the `DRAFT`, `SCHEDULED`, `UNPAID`, or `PARTIALLY_PAID` state.
     *
     * @param invoiceId     The ID of the [invoice](entity:Invoice) to delete the attachment from.
     * @param attachmentId  The ID of the [attachment](entity:InvoiceAttachment) to delete.
     * @return Response from the API call
     */
    async deleteInvoiceAttachment(invoiceId, attachmentId, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            invoiceId: [invoiceId, string()],
            attachmentId: [attachmentId, string()],
        });
        req.appendTemplatePath `/v2/invoices/${mapped.invoiceId}/attachments/${mapped.attachmentId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteInvoiceAttachmentResponseSchema, requestOptions);
    }
    /**
     * Cancels an invoice. The seller cannot collect payments for
     * the canceled invoice.
     *
     * You cannot cancel an invoice in the `DRAFT` state or in a terminal state: `PAID`, `REFUNDED`,
     * `CANCELED`, or `FAILED`.
     *
     * @param invoiceId    The ID of the [invoice](entity:Invoice) to cancel.
     * @param body         An object containing the fields to POST for the request.  See
     *                                                    the corresponding object definition for field details.
     * @return Response from the API call
     */
    async cancelInvoice(invoiceId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            invoiceId: [invoiceId, string()],
            body: [body, cancelInvoiceRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/invoices/${mapped.invoiceId}/cancel`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(cancelInvoiceResponseSchema, requestOptions);
    }
    /**
     * Publishes the specified draft invoice.
     *
     * After an invoice is published, Square
     * follows up based on the invoice configuration. For example, Square
     * sends the invoice to the customer's email address, charges the customer's card on file, or does
     * nothing. Square also makes the invoice available on a Square-hosted invoice page.
     *
     * The invoice `status` also changes from `DRAFT` to a status
     * based on the invoice configuration. For example, the status changes to `UNPAID` if
     * Square emails the invoice or `PARTIALLY_PAID` if Square charges a card on file for a portion of the
     * invoice amount.
     *
     * In addition to the required `ORDERS_WRITE` and `INVOICES_WRITE` permissions, `CUSTOMERS_READ`
     * and `PAYMENTS_WRITE` are required when publishing invoices configured for card-on-file payments.
     *
     * @param invoiceId    The ID of the invoice to publish.
     * @param body         An object containing the fields to POST for the request.  See
     *                                                     the corresponding object definition for field details.
     * @return Response from the API call
     */
    async publishInvoice(invoiceId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            invoiceId: [invoiceId, string()],
            body: [body, publishInvoiceRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/invoices/${mapped.invoiceId}/publish`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(publishInvoiceResponseSchema, requestOptions);
    }
}

const breakTypeSchema = object({
    id: ['id', optional(string())],
    locationId: ['location_id', string()],
    breakName: ['break_name', string()],
    expectedDuration: ['expected_duration', string()],
    isPaid: ['is_paid', boolean()],
    version: ['version', optional(number())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
});

const createBreakTypeRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(string())],
    breakType: ['break_type', lazy(() => breakTypeSchema)],
});

const createBreakTypeResponseSchema = object({
    breakType: ['break_type', optional(lazy(() => breakTypeSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const breakSchema = object({
    id: ['id', optional(string())],
    startAt: ['start_at', string()],
    endAt: ['end_at', optional(nullable(string()))],
    breakTypeId: ['break_type_id', string()],
    name: ['name', string()],
    expectedDuration: ['expected_duration', string()],
    isPaid: ['is_paid', boolean()],
});

const shiftWageSchema = object({
    title: ['title', optional(nullable(string()))],
    hourlyRate: ['hourly_rate', optional(lazy(() => moneySchema))],
    jobId: ['job_id', optional(string())],
    tipEligible: ['tip_eligible', optional(nullable(boolean()))],
});

const shiftSchema = object({
    id: ['id', optional(string())],
    employeeId: ['employee_id', optional(nullable(string()))],
    locationId: ['location_id', string()],
    timezone: ['timezone', optional(nullable(string()))],
    startAt: ['start_at', string()],
    endAt: ['end_at', optional(nullable(string()))],
    wage: ['wage', optional(lazy(() => shiftWageSchema))],
    breaks: ['breaks', optional(nullable(array(lazy(() => breakSchema))))],
    status: ['status', optional(string())],
    version: ['version', optional(number())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    teamMemberId: ['team_member_id', optional(nullable(string()))],
    declaredCashTipMoney: [
        'declared_cash_tip_money',
        optional(lazy(() => moneySchema)),
    ],
});

const createShiftRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(string())],
    shift: ['shift', lazy(() => shiftSchema)],
});

const createShiftResponseSchema = object({
    shift: ['shift', optional(lazy(() => shiftSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const deleteBreakTypeResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const deleteShiftResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const getBreakTypeResponseSchema = object({
    breakType: ['break_type', optional(lazy(() => breakTypeSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const employeeWageSchema = object({
    id: ['id', optional(string())],
    employeeId: ['employee_id', optional(nullable(string()))],
    title: ['title', optional(nullable(string()))],
    hourlyRate: ['hourly_rate', optional(lazy(() => moneySchema))],
});

const getEmployeeWageResponseSchema = object({
    employeeWage: ['employee_wage', optional(lazy(() => employeeWageSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const getShiftResponseSchema = object({
    shift: ['shift', optional(lazy(() => shiftSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const teamMemberWageSchema = object({
    id: ['id', optional(string())],
    teamMemberId: ['team_member_id', optional(nullable(string()))],
    title: ['title', optional(nullable(string()))],
    hourlyRate: ['hourly_rate', optional(lazy(() => moneySchema))],
    jobId: ['job_id', optional(nullable(string()))],
    tipEligible: ['tip_eligible', optional(nullable(boolean()))],
});

const getTeamMemberWageResponseSchema = object({
    teamMemberWage: [
        'team_member_wage',
        optional(lazy(() => teamMemberWageSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const listBreakTypesResponseSchema = object({
    breakTypes: ['break_types', optional(array(lazy(() => breakTypeSchema)))],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const listEmployeeWagesResponseSchema = object({
    employeeWages: [
        'employee_wages',
        optional(array(lazy(() => employeeWageSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const listTeamMemberWagesResponseSchema = object({
    teamMemberWages: [
        'team_member_wages',
        optional(array(lazy(() => teamMemberWageSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const workweekConfigSchema = object({
    id: ['id', optional(string())],
    startOfWeek: ['start_of_week', string()],
    startOfDayLocalTime: ['start_of_day_local_time', string()],
    version: ['version', optional(number())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
});

const listWorkweekConfigsResponseSchema = object({
    workweekConfigs: [
        'workweek_configs',
        optional(array(lazy(() => workweekConfigSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const dateRangeSchema = object({
    startDate: ['start_date', optional(nullable(string()))],
    endDate: ['end_date', optional(nullable(string()))],
});

const shiftWorkdaySchema = object({
    dateRange: ['date_range', optional(lazy(() => dateRangeSchema))],
    matchShiftsBy: ['match_shifts_by', optional(string())],
    defaultTimezone: ['default_timezone', optional(nullable(string()))],
});

const shiftFilterSchema = object({
    locationIds: ['location_ids', optional(nullable(array(string())))],
    employeeIds: ['employee_ids', optional(nullable(array(string())))],
    status: ['status', optional(string())],
    start: ['start', optional(lazy(() => timeRangeSchema))],
    end: ['end', optional(lazy(() => timeRangeSchema))],
    workday: ['workday', optional(lazy(() => shiftWorkdaySchema))],
    teamMemberIds: ['team_member_ids', optional(nullable(array(string())))],
});

const shiftSortSchema = object({
    field: ['field', optional(string())],
    order: ['order', optional(string())],
});

const shiftQuerySchema = object({
    filter: ['filter', optional(lazy(() => shiftFilterSchema))],
    sort: ['sort', optional(lazy(() => shiftSortSchema))],
});

const searchShiftsRequestSchema = object({
    query: ['query', optional(lazy(() => shiftQuerySchema))],
    limit: ['limit', optional(number())],
    cursor: ['cursor', optional(string())],
});

const searchShiftsResponseSchema = object({
    shifts: ['shifts', optional(array(lazy(() => shiftSchema)))],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateBreakTypeRequestSchema = object({ breakType: ['break_type', lazy(() => breakTypeSchema)] });

const updateBreakTypeResponseSchema = object({
    breakType: ['break_type', optional(lazy(() => breakTypeSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateShiftRequestSchema = object({
    shift: ['shift', lazy(() => shiftSchema)],
});

const updateShiftResponseSchema = object({
    shift: ['shift', optional(lazy(() => shiftSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateWorkweekConfigRequestSchema = object({ workweekConfig: ['workweek_config', lazy(() => workweekConfigSchema)] });

const updateWorkweekConfigResponseSchema = object({
    workweekConfig: [
        'workweek_config',
        optional(lazy(() => workweekConfigSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class LaborApi extends BaseApi {
    /**
     * Returns a paginated list of `BreakType` instances for a business.
     *
     * @param locationId  Filter the returned `BreakType` results to only those that are associated with the
     *                              specified location.
     * @param limit       The maximum number of `BreakType` results to return per page. The number can range
     *                              between 1 and 200. The default is 200.
     * @param cursor      A pointer to the next page of `BreakType` results to fetch.
     * @return Response from the API call
     */
    async listBreakTypes(locationId, limit, cursor, requestOptions) {
        const req = this.createRequest('GET', '/v2/labor/break-types');
        const mapped = req.prepareArgs({
            locationId: [locationId, optional(string())],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
        });
        req.query('location_id', mapped.locationId);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listBreakTypesResponseSchema, requestOptions);
    }
    /**
     * Creates a new `BreakType`.
     *
     * A `BreakType` is a template for creating `Break` objects.
     * You must provide the following values in your request to this
     * endpoint:
     *
     * - `location_id`
     * - `break_name`
     * - `expected_duration`
     * - `is_paid`
     *
     * You can only have three `BreakType` instances per location. If you attempt to add a fourth
     * `BreakType` for a location, an `INVALID_REQUEST_ERROR` "Exceeded limit of 3 breaks per location."
     * is returned.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                      See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createBreakType(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/labor/break-types');
        const mapped = req.prepareArgs({
            body: [body, createBreakTypeRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createBreakTypeResponseSchema, requestOptions);
    }
    /**
     * Deletes an existing `BreakType`.
     *
     * A `BreakType` can be deleted even if it is referenced from a `Shift`.
     *
     * @param id The UUID for the `BreakType` being deleted.
     * @return Response from the API call
     */
    async deleteBreakType(id, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({ id: [id, string()] });
        req.appendTemplatePath `/v2/labor/break-types/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteBreakTypeResponseSchema, requestOptions);
    }
    /**
     * Returns a single `BreakType` specified by `id`.
     *
     * @param id The UUID for the `BreakType` being retrieved.
     * @return Response from the API call
     */
    async getBreakType(id, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ id: [id, string()] });
        req.appendTemplatePath `/v2/labor/break-types/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getBreakTypeResponseSchema, requestOptions);
    }
    /**
     * Updates an existing `BreakType`.
     *
     * @param id           The UUID for the `BreakType` being updated.
     * @param body         An object containing the fields to POST for the request.
     *                                                      See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async updateBreakType(id, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            id: [id, string()],
            body: [body, updateBreakTypeRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/labor/break-types/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateBreakTypeResponseSchema, requestOptions);
    }
    /**
     * Returns a paginated list of `EmployeeWage` instances for a business.
     *
     * @param employeeId  Filter the returned wages to only those that are associated with the specified
     *                              employee.
     * @param limit       The maximum number of `EmployeeWage` results to return per page. The number can
     *                              range between 1 and 200. The default is 200.
     * @param cursor      A pointer to the next page of `EmployeeWage` results to fetch.
     * @return Response from the API call
     * @deprecated
     */
    async listEmployeeWages(employeeId, limit, cursor, requestOptions) {
        const req = this.createRequest('GET', '/v2/labor/employee-wages');
        const mapped = req.prepareArgs({
            employeeId: [employeeId, optional(string())],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
        });
        req.query('employee_id', mapped.employeeId);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.deprecated('LaborApi.listEmployeeWages');
        req.authenticate([{ global: true }]);
        return req.callAsJson(listEmployeeWagesResponseSchema, requestOptions);
    }
    /**
     * Returns a single `EmployeeWage` specified by `id`.
     *
     * @param id The UUID for the `EmployeeWage` being retrieved.
     * @return Response from the API call
     * @deprecated
     */
    async getEmployeeWage(id, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ id: [id, string()] });
        req.appendTemplatePath `/v2/labor/employee-wages/${mapped.id}`;
        req.deprecated('LaborApi.getEmployeeWage');
        req.authenticate([{ global: true }]);
        return req.callAsJson(getEmployeeWageResponseSchema, requestOptions);
    }
    /**
     * Creates a new `Shift`.
     *
     * A `Shift` represents a complete workday for a single team member.
     * You must provide the following values in your request to this
     * endpoint:
     *
     * - `location_id`
     * - `team_member_id`
     * - `start_at`
     *
     * An attempt to create a new `Shift` can result in a `BAD_REQUEST` error when:
     * - The `status` of the new `Shift` is `OPEN` and the team member has another
     * shift with an `OPEN` status.
     * - The `start_at` date is in the future.
     * - The `start_at` or `end_at` date overlaps another shift for the same team member.
     * - The `Break` instances are set in the request and a break `start_at`
     * is before the `Shift.start_at`, a break `end_at` is after
     * the `Shift.end_at`, or both.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                  the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createShift(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/labor/shifts');
        const mapped = req.prepareArgs({ body: [body, createShiftRequestSchema] });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createShiftResponseSchema, requestOptions);
    }
    /**
     * Returns a paginated list of `Shift` records for a business.
     * The list to be returned can be filtered by:
     * - Location IDs
     * - Team member IDs
     * - Shift status (`OPEN` or `CLOSED`)
     * - Shift start
     * - Shift end
     * - Workday details
     *
     * The list can be sorted by:
     * - `START_AT`
     * - `END_AT`
     * - `CREATED_AT`
     * - `UPDATED_AT`
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                   the corresponding object definition for field details.
     * @return Response from the API call
     */
    async searchShifts(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/labor/shifts/search');
        const mapped = req.prepareArgs({ body: [body, searchShiftsRequestSchema] });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchShiftsResponseSchema, requestOptions);
    }
    /**
     * Deletes a `Shift`.
     *
     * @param id The UUID for the `Shift` being deleted.
     * @return Response from the API call
     */
    async deleteShift(id, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({ id: [id, string()] });
        req.appendTemplatePath `/v2/labor/shifts/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteShiftResponseSchema, requestOptions);
    }
    /**
     * Returns a single `Shift` specified by `id`.
     *
     * @param id The UUID for the `Shift` being retrieved.
     * @return Response from the API call
     */
    async getShift(id, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ id: [id, string()] });
        req.appendTemplatePath `/v2/labor/shifts/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getShiftResponseSchema, requestOptions);
    }
    /**
     * Updates an existing `Shift`.
     *
     * When adding a `Break` to a `Shift`, any earlier `Break` instances in the `Shift` have
     * the `end_at` property set to a valid RFC-3339 datetime string.
     *
     * When closing a `Shift`, all `Break` instances in the `Shift` must be complete with `end_at`
     * set on each `Break`.
     *
     * @param id           The ID of the object being updated.
     * @param body         An object containing the fields to POST for the request.  See
     *                                                  the corresponding object definition for field details.
     * @return Response from the API call
     */
    async updateShift(id, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            id: [id, string()],
            body: [body, updateShiftRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/labor/shifts/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateShiftResponseSchema, requestOptions);
    }
    /**
     * Returns a paginated list of `TeamMemberWage` instances for a business.
     *
     * @param teamMemberId   Filter the returned wages to only those that are associated with the specified
     *                                 team member.
     * @param limit          The maximum number of `TeamMemberWage` results to return per page. The number can
     *                                 range between 1 and 200. The default is 200.
     * @param cursor         A pointer to the next page of `EmployeeWage` results to fetch.
     * @return Response from the API call
     */
    async listTeamMemberWages(teamMemberId, limit, cursor, requestOptions) {
        const req = this.createRequest('GET', '/v2/labor/team-member-wages');
        const mapped = req.prepareArgs({
            teamMemberId: [teamMemberId, optional(string())],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
        });
        req.query('team_member_id', mapped.teamMemberId);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listTeamMemberWagesResponseSchema, requestOptions);
    }
    /**
     * Returns a single `TeamMemberWage` specified by `id`.
     *
     * @param id The UUID for the `TeamMemberWage` being retrieved.
     * @return Response from the API call
     */
    async getTeamMemberWage(id, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ id: [id, string()] });
        req.appendTemplatePath `/v2/labor/team-member-wages/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getTeamMemberWageResponseSchema, requestOptions);
    }
    /**
     * Returns a list of `WorkweekConfig` instances for a business.
     *
     * @param limit  The maximum number of `WorkweekConfigs` results to return per page.
     * @param cursor A pointer to the next page of `WorkweekConfig` results to fetch.
     * @return Response from the API call
     */
    async listWorkweekConfigs(limit, cursor, requestOptions) {
        const req = this.createRequest('GET', '/v2/labor/workweek-configs');
        const mapped = req.prepareArgs({
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
        });
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listWorkweekConfigsResponseSchema, requestOptions);
    }
    /**
     * Updates a `WorkweekConfig`.
     *
     * @param id           The UUID for the `WorkweekConfig` object being updated.
     * @param body         An object containing the fields to POST for the request.
     *                                                           See the corresponding object definition for field
     *                                                           details.
     * @return Response from the API call
     */
    async updateWorkweekConfig(id, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            id: [id, string()],
            body: [body, updateWorkweekConfigRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/labor/workweek-configs/${mapped.id}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateWorkweekConfigResponseSchema, requestOptions);
    }
}

const bulkDeleteLocationCustomAttributesRequestLocationCustomAttributeDeleteRequestSchema = object({ key: ['key', optional(string())] });

const bulkDeleteLocationCustomAttributesRequestSchema = object({
    values: [
        'values',
        dict(lazy(() => bulkDeleteLocationCustomAttributesRequestLocationCustomAttributeDeleteRequestSchema)),
    ],
});

const bulkDeleteLocationCustomAttributesResponseLocationCustomAttributeDeleteResponseSchema = object({
    locationId: ['location_id', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkDeleteLocationCustomAttributesResponseSchema = object({
    values: [
        'values',
        dict(lazy(() => bulkDeleteLocationCustomAttributesResponseLocationCustomAttributeDeleteResponseSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkUpsertLocationCustomAttributesRequestLocationCustomAttributeUpsertRequestSchema = object({
    locationId: ['location_id', string()],
    customAttribute: ['custom_attribute', lazy(() => customAttributeSchema)],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const bulkUpsertLocationCustomAttributesRequestSchema = object({
    values: [
        'values',
        dict(lazy(() => bulkUpsertLocationCustomAttributesRequestLocationCustomAttributeUpsertRequestSchema)),
    ],
});

const bulkUpsertLocationCustomAttributesResponseLocationCustomAttributeUpsertResponseSchema = object({
    locationId: ['location_id', optional(string())],
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkUpsertLocationCustomAttributesResponseSchema = object({
    values: [
        'values',
        optional(dict(lazy(() => bulkUpsertLocationCustomAttributesResponseLocationCustomAttributeUpsertResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const createLocationCustomAttributeDefinitionRequestSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        lazy(() => customAttributeDefinitionSchema),
    ],
    idempotencyKey: ['idempotency_key', optional(string())],
});

const createLocationCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const deleteLocationCustomAttributeDefinitionResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const deleteLocationCustomAttributeResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const listLocationCustomAttributeDefinitionsResponseSchema = object({
    customAttributeDefinitions: [
        'custom_attribute_definitions',
        optional(array(lazy(() => customAttributeDefinitionSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const listLocationCustomAttributesResponseSchema = object({
    customAttributes: [
        'custom_attributes',
        optional(array(lazy(() => customAttributeSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveLocationCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveLocationCustomAttributeResponseSchema = object({
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateLocationCustomAttributeDefinitionRequestSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        lazy(() => customAttributeDefinitionSchema),
    ],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const updateLocationCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const upsertLocationCustomAttributeRequestSchema = object({
    customAttribute: ['custom_attribute', lazy(() => customAttributeSchema)],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const upsertLocationCustomAttributeResponseSchema = object({
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class LocationCustomAttributesApi extends BaseApi {
    /**
     * Lists the location-related [custom attribute definitions]($m/CustomAttributeDefinition) that belong
     * to a Square seller account.
     * When all response pages are retrieved, the results include all custom attribute definitions
     * that are visible to the requesting application, including those that are created by other
     * applications and set to `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param visibilityFilter  Filters the `CustomAttributeDefinition` results by their `visibility` values.
     * @param limit             The maximum number of results to return in a single paged response. This limit
     *                                    is advisory. The response might contain more or fewer results. The minimum
     *                                    value is 1 and the maximum value is 100. The default value is 20. For more
     *                                    information, see [Pagination](https://developer.squareup.com/docs/build-
     *                                    basics/common-api-patterns/pagination).
     * @param cursor            The cursor returned in the paged response from the previous call to this
     *                                    endpoint. Provide this cursor to retrieve the next page of results for your
     *                                    original request. For more information, see [Pagination](https://developer.
     *                                    squareup.com/docs/build-basics/common-api-patterns/pagination).
     * @return Response from the API call
     */
    async listLocationCustomAttributeDefinitions(visibilityFilter, limit, cursor, requestOptions) {
        const req = this.createRequest('GET', '/v2/locations/custom-attribute-definitions');
        const mapped = req.prepareArgs({
            visibilityFilter: [visibilityFilter, optional(string())],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
        });
        req.query('visibility_filter', mapped.visibilityFilter);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listLocationCustomAttributeDefinitionsResponseSchema, requestOptions);
    }
    /**
     * Creates a location-related [custom attribute definition]($m/CustomAttributeDefinition) for a Square
     * seller account.
     * Use this endpoint to define a custom attribute that can be associated with locations.
     * A custom attribute definition specifies the `key`, `visibility`, `schema`, and other properties
     * for a custom attribute. After the definition is created, you can call
     * [UpsertLocationCustomAttribute]($e/LocationCustomAttributes/UpsertLocationCustomAttribute) or
     * [BulkUpsertLocationCustomAttributes]($e/LocationCustomAttributes/BulkUpsertLocationCustomAttributes)
     * to set the custom attribute for locations.
     *
     * @param body         An object containing the fields to
     *                                                                              POST for the request.  See the
     *                                                                              corresponding object definition for
     *                                                                              field details.
     * @return Response from the API call
     */
    async createLocationCustomAttributeDefinition(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/locations/custom-attribute-definitions');
        const mapped = req.prepareArgs({
            body: [body, createLocationCustomAttributeDefinitionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createLocationCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Deletes a location-related [custom attribute definition]($m/CustomAttributeDefinition) from a Square
     * seller account.
     * Deleting a custom attribute definition also deletes the corresponding custom attribute from
     * all locations.
     * Only the definition owner can delete a custom attribute definition.
     *
     * @param key The key of the custom attribute definition to delete.
     * @return Response from the API call
     */
    async deleteLocationCustomAttributeDefinition(key, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({ key: [key, string()] });
        req.appendTemplatePath `/v2/locations/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteLocationCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Retrieves a location-related [custom attribute definition]($m/CustomAttributeDefinition) from a
     * Square seller account.
     * To retrieve a custom attribute definition created by another application, the `visibility`
     * setting must be `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param key     The key of the custom attribute definition to retrieve. If the requesting application is
     *                          not the definition owner, you must use the qualified key.
     * @param version The current version of the custom attribute definition, which is used for strongly
     *                          consistent reads to guarantee that you receive the most up-to-date data. When included in
     *                          the request, Square returns the specified version or a higher version if one exists. If
     *                          the specified version is higher than the current version, Square returns a `BAD_REQUEST`
     *                          error.
     * @return Response from the API call
     */
    async retrieveLocationCustomAttributeDefinition(key, version, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            key: [key, string()],
            version: [version, optional(number())],
        });
        req.query('version', mapped.version);
        req.appendTemplatePath `/v2/locations/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveLocationCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Updates a location-related [custom attribute definition]($m/CustomAttributeDefinition) for a Square
     * seller account.
     * Use this endpoint to update the following fields: `name`, `description`, `visibility`, or the
     * `schema` for a `Selection` data type.
     * Only the definition owner can update a custom attribute definition.
     *
     * @param key          The key of the custom attribute
     *                                                                              definition to update.
     * @param body         An object containing the fields to
     *                                                                              POST for the request.  See the
     *                                                                              corresponding object definition for
     *                                                                              field details.
     * @return Response from the API call
     */
    async updateLocationCustomAttributeDefinition(key, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            key: [key, string()],
            body: [body, updateLocationCustomAttributeDefinitionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/locations/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateLocationCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Deletes [custom attributes]($m/CustomAttribute) for locations as a bulk operation.
     * To delete a custom attribute owned by another application, the `visibility` setting must be
     * `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param body         An object containing the fields to POST
     *                                                                         for the request.  See the corresponding
     *                                                                         object definition for field details.
     * @return Response from the API call
     */
    async bulkDeleteLocationCustomAttributes(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/locations/custom-attributes/bulk-delete');
        const mapped = req.prepareArgs({
            body: [body, bulkDeleteLocationCustomAttributesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkDeleteLocationCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Creates or updates [custom attributes]($m/CustomAttribute) for locations as a bulk operation.
     * Use this endpoint to set the value of one or more custom attributes for one or more locations.
     * A custom attribute is based on a custom attribute definition in a Square seller account, which is
     * created using the
     * [CreateLocationCustomAttributeDefinition]($e/LocationCustomAttributes/CreateLocationCustomAttributeD
     * efinition) endpoint.
     * This `BulkUpsertLocationCustomAttributes` endpoint accepts a map of 1 to 25 individual upsert
     * requests and returns a map of individual upsert responses. Each upsert request has a unique ID
     * and provides a location ID and custom attribute. Each upsert response is returned with the ID
     * of the corresponding request.
     * To create or update a custom attribute owned by another application, the `visibility` setting
     * must be `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param body         An object containing the fields to POST
     *                                                                         for the request.  See the corresponding
     *                                                                         object definition for field details.
     * @return Response from the API call
     */
    async bulkUpsertLocationCustomAttributes(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/locations/custom-attributes/bulk-upsert');
        const mapped = req.prepareArgs({
            body: [body, bulkUpsertLocationCustomAttributesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkUpsertLocationCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Lists the [custom attributes]($m/CustomAttribute) associated with a location.
     * You can use the `with_definitions` query parameter to also retrieve custom attribute definitions
     * in the same call.
     * When all response pages are retrieved, the results include all custom attributes that are
     * visible to the requesting application, including those that are owned by other applications
     * and set to `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param locationId        The ID of the target [location](entity:Location).
     * @param visibilityFilter  Filters the `CustomAttributeDefinition` results by their `visibility` values.
     * @param limit             The maximum number of results to return in a single paged response. This
     *                                     limit is advisory. The response might contain more or fewer results. The
     *                                     minimum value is 1 and the maximum value is 100. The default value is 20. For
     *                                     more information, see [Pagination](https://developer.squareup.com/docs/build-
     *                                     basics/common-api-patterns/pagination).
     * @param cursor            The cursor returned in the paged response from the previous call to this
     *                                     endpoint. Provide this cursor to retrieve the next page of results for your
     *                                     original request. For more information, see [Pagination](https://developer.
     *                                     squareup.com/docs/build-basics/common-api-patterns/pagination).
     * @param withDefinitions   Indicates whether to return the [custom attribute definition](entity:
     *                                     CustomAttributeDefinition) in the `definition` field of each custom attribute.
     *                                     Set this parameter to `true` to get the name and description of each custom
     *                                     attribute, information about the data type, or other definition details. The
     *                                     default value is `false`.
     * @return Response from the API call
     */
    async listLocationCustomAttributes(locationId, visibilityFilter, limit, cursor, withDefinitions, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            visibilityFilter: [visibilityFilter, optional(string())],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
            withDefinitions: [withDefinitions, optional(boolean())],
        });
        req.query('visibility_filter', mapped.visibilityFilter);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.query('with_definitions', mapped.withDefinitions);
        req.appendTemplatePath `/v2/locations/${mapped.locationId}/custom-attributes`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(listLocationCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Deletes a [custom attribute]($m/CustomAttribute) associated with a location.
     * To delete a custom attribute owned by another application, the `visibility` setting must be
     * `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param locationId  The ID of the target [location](entity:Location).
     * @param key         The key of the custom attribute to delete. This key must match the `key` of a custom
     *                              attribute definition in the Square seller account. If the requesting application is
     *                              not the definition owner, you must use the qualified key.
     * @return Response from the API call
     */
    async deleteLocationCustomAttribute(locationId, key, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            key: [key, string()],
        });
        req.appendTemplatePath `/v2/locations/${mapped.locationId}/custom-attributes/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteLocationCustomAttributeResponseSchema, requestOptions);
    }
    /**
     * Retrieves a [custom attribute]($m/CustomAttribute) associated with a location.
     * You can use the `with_definition` query parameter to also retrieve the custom attribute definition
     * in the same call.
     * To retrieve a custom attribute owned by another application, the `visibility` setting must be
     * `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param locationId      The ID of the target [location](entity:Location).
     * @param key             The key of the custom attribute to retrieve. This key must match the `key` of a
     *                                   custom attribute definition in the Square seller account. If the requesting
     *                                   application is not the definition owner, you must use the qualified key.
     * @param withDefinition  Indicates whether to return the [custom attribute definition](entity:
     *                                   CustomAttributeDefinition) in the `definition` field of the custom attribute.
     *                                   Set this parameter to `true` to get the name and description of the custom
     *                                   attribute, information about the data type, or other definition details. The
     *                                   default value is `false`.
     * @param version         The current version of the custom attribute, which is used for strongly
     *                                   consistent reads to guarantee that you receive the most up-to-date data. When
     *                                   included in the request, Square returns the specified version or a higher
     *                                   version if one exists. If the specified version is higher than the current
     *                                   version, Square returns a `BAD_REQUEST` error.
     * @return Response from the API call
     */
    async retrieveLocationCustomAttribute(locationId, key, withDefinition, version, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            key: [key, string()],
            withDefinition: [withDefinition, optional(boolean())],
            version: [version, optional(number())],
        });
        req.query('with_definition', mapped.withDefinition);
        req.query('version', mapped.version);
        req.appendTemplatePath `/v2/locations/${mapped.locationId}/custom-attributes/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveLocationCustomAttributeResponseSchema, requestOptions);
    }
    /**
     * Creates or updates a [custom attribute]($m/CustomAttribute) for a location.
     * Use this endpoint to set the value of a custom attribute for a specified location.
     * A custom attribute is based on a custom attribute definition in a Square seller account, which
     * is created using the
     * [CreateLocationCustomAttributeDefinition]($e/LocationCustomAttributes/CreateLocationCustomAttributeD
     * efinition) endpoint.
     * To create or update a custom attribute owned by another application, the `visibility` setting
     * must be `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param locationId   The ID of the target [location](entity:
     *                                                                    Location).
     * @param key          The key of the custom attribute to create or
     *                                                                    update. This key must match the `key` of a
     *                                                                    custom attribute definition in the Square
     *                                                                    seller account. If the requesting application
     *                                                                    is not the definition owner, you must use the
     *                                                                    qualified key.
     * @param body         An object containing the fields to POST for
     *                                                                    the request.  See the corresponding object
     *                                                                    definition for field details.
     * @return Response from the API call
     */
    async upsertLocationCustomAttribute(locationId, key, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            key: [key, string()],
            body: [body, upsertLocationCustomAttributeRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/locations/${mapped.locationId}/custom-attributes/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(upsertLocationCustomAttributeResponseSchema, requestOptions);
    }
}

const businessHoursPeriodSchema = object({
    dayOfWeek: ['day_of_week', optional(string())],
    startLocalTime: ['start_local_time', optional(nullable(string()))],
    endLocalTime: ['end_local_time', optional(nullable(string()))],
});

const businessHoursSchema = object({
    periods: [
        'periods',
        optional(nullable(array(lazy(() => businessHoursPeriodSchema)))),
    ],
});

const coordinatesSchema = object({
    latitude: ['latitude', optional(nullable(number()))],
    longitude: ['longitude', optional(nullable(number()))],
});

const taxIdsSchema = object({
    euVat: ['eu_vat', optional(string())],
    frSiret: ['fr_siret', optional(string())],
    frNaf: ['fr_naf', optional(string())],
    esNif: ['es_nif', optional(string())],
    jpQii: ['jp_qii', optional(string())],
});

const locationSchema = object({
    id: ['id', optional(string())],
    name: ['name', optional(nullable(string()))],
    address: ['address', optional(lazy(() => addressSchema))],
    timezone: ['timezone', optional(nullable(string()))],
    capabilities: ['capabilities', optional(array(string()))],
    status: ['status', optional(string())],
    createdAt: ['created_at', optional(string())],
    merchantId: ['merchant_id', optional(string())],
    country: ['country', optional(string())],
    languageCode: ['language_code', optional(nullable(string()))],
    currency: ['currency', optional(string())],
    phoneNumber: ['phone_number', optional(nullable(string()))],
    businessName: ['business_name', optional(nullable(string()))],
    type: ['type', optional(string())],
    websiteUrl: ['website_url', optional(nullable(string()))],
    businessHours: ['business_hours', optional(lazy(() => businessHoursSchema))],
    businessEmail: ['business_email', optional(nullable(string()))],
    description: ['description', optional(nullable(string()))],
    twitterUsername: ['twitter_username', optional(nullable(string()))],
    instagramUsername: ['instagram_username', optional(nullable(string()))],
    facebookUrl: ['facebook_url', optional(nullable(string()))],
    coordinates: ['coordinates', optional(lazy(() => coordinatesSchema))],
    logoUrl: ['logo_url', optional(string())],
    posBackgroundUrl: ['pos_background_url', optional(string())],
    mcc: ['mcc', optional(nullable(string()))],
    fullFormatLogoUrl: ['full_format_logo_url', optional(string())],
    taxIds: ['tax_ids', optional(lazy(() => taxIdsSchema))],
});

const createLocationRequestSchema = object({ location: ['location', optional(lazy(() => locationSchema))] });

const createLocationResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    location: ['location', optional(lazy(() => locationSchema))],
});

const listLocationsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    locations: ['locations', optional(array(lazy(() => locationSchema)))],
});

const retrieveLocationResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    location: ['location', optional(lazy(() => locationSchema))],
});

const updateLocationRequestSchema = object({ location: ['location', optional(lazy(() => locationSchema))] });

const updateLocationResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    location: ['location', optional(lazy(() => locationSchema))],
});

class LocationsApi extends BaseApi {
    /**
     * Provides details about all of the seller's [locations](https://developer.squareup.com/docs/locations-
     * api),
     * including those with an inactive status. Locations are listed alphabetically by `name`.
     *
     * @return Response from the API call
     */
    async listLocations(requestOptions) {
        const req = this.createRequest('GET', '/v2/locations');
        req.authenticate([{ global: true }]);
        return req.callAsJson(listLocationsResponseSchema, requestOptions);
    }
    /**
     * Creates a [location](https://developer.squareup.com/docs/locations-api).
     * Creating new locations allows for separate configuration of receipt layouts, item prices,
     * and sales reports. Developers can use locations to separate sales activity through applications
     * that integrate with Square from sales activity elsewhere in a seller's account.
     * Locations created programmatically with the Locations API last forever and
     * are visible to the seller for their own management. Therefore, ensure that
     * each location has a sensible and unique name.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                     the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createLocation(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/locations');
        const mapped = req.prepareArgs({
            body: [body, createLocationRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createLocationResponseSchema, requestOptions);
    }
    /**
     * Retrieves details of a single location. Specify "main"
     * as the location ID to retrieve details of the [main location](https://developer.squareup.
     * com/docs/locations-api#about-the-main-location).
     *
     * @param locationId  The ID of the location to retrieve. Specify the string "main" to return the main
     *                              location.
     * @return Response from the API call
     */
    async retrieveLocation(locationId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ locationId: [locationId, string()] });
        req.appendTemplatePath `/v2/locations/${mapped.locationId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveLocationResponseSchema, requestOptions);
    }
    /**
     * Updates a [location](https://developer.squareup.com/docs/locations-api).
     *
     * @param locationId   The ID of the location to update.
     * @param body         An object containing the fields to POST for the request.  See
     *                                                     the corresponding object definition for field details.
     * @return Response from the API call
     */
    async updateLocation(locationId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            body: [body, updateLocationRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/locations/${mapped.locationId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateLocationResponseSchema, requestOptions);
    }
}

const loyaltyEventAccumulatePointsSchema = object({
    loyaltyProgramId: ['loyalty_program_id', optional(string())],
    points: ['points', optional(nullable(number()))],
    orderId: ['order_id', optional(nullable(string()))],
});

const accumulateLoyaltyPointsRequestSchema = object({
    accumulatePoints: [
        'accumulate_points',
        lazy(() => loyaltyEventAccumulatePointsSchema),
    ],
    idempotencyKey: ['idempotency_key', string()],
    locationId: ['location_id', string()],
});

const loyaltyEventAccumulatePromotionPointsSchema = object({
    loyaltyProgramId: ['loyalty_program_id', optional(string())],
    loyaltyPromotionId: ['loyalty_promotion_id', optional(string())],
    points: ['points', number()],
    orderId: ['order_id', string()],
});

const loyaltyEventAdjustPointsSchema = object({
    loyaltyProgramId: ['loyalty_program_id', optional(string())],
    points: ['points', number()],
    reason: ['reason', optional(nullable(string()))],
});

const loyaltyEventCreateRewardSchema = object({
    loyaltyProgramId: ['loyalty_program_id', string()],
    rewardId: ['reward_id', optional(string())],
    points: ['points', number()],
});

const loyaltyEventDeleteRewardSchema = object({
    loyaltyProgramId: ['loyalty_program_id', string()],
    rewardId: ['reward_id', optional(string())],
    points: ['points', number()],
});

const loyaltyEventExpirePointsSchema = object({
    loyaltyProgramId: ['loyalty_program_id', string()],
    points: ['points', number()],
});

const loyaltyEventOtherSchema = object({
    loyaltyProgramId: ['loyalty_program_id', string()],
    points: ['points', number()],
});

const loyaltyEventRedeemRewardSchema = object({
    loyaltyProgramId: ['loyalty_program_id', string()],
    rewardId: ['reward_id', optional(string())],
    orderId: ['order_id', optional(string())],
});

const loyaltyEventSchema = object({
    id: ['id', string()],
    type: ['type', string()],
    createdAt: ['created_at', string()],
    accumulatePoints: [
        'accumulate_points',
        optional(lazy(() => loyaltyEventAccumulatePointsSchema)),
    ],
    createReward: [
        'create_reward',
        optional(lazy(() => loyaltyEventCreateRewardSchema)),
    ],
    redeemReward: [
        'redeem_reward',
        optional(lazy(() => loyaltyEventRedeemRewardSchema)),
    ],
    deleteReward: [
        'delete_reward',
        optional(lazy(() => loyaltyEventDeleteRewardSchema)),
    ],
    adjustPoints: [
        'adjust_points',
        optional(lazy(() => loyaltyEventAdjustPointsSchema)),
    ],
    loyaltyAccountId: ['loyalty_account_id', string()],
    locationId: ['location_id', optional(string())],
    source: ['source', string()],
    expirePoints: [
        'expire_points',
        optional(lazy(() => loyaltyEventExpirePointsSchema)),
    ],
    otherEvent: ['other_event', optional(lazy(() => loyaltyEventOtherSchema))],
    accumulatePromotionPoints: [
        'accumulate_promotion_points',
        optional(lazy(() => loyaltyEventAccumulatePromotionPointsSchema)),
    ],
});

const accumulateLoyaltyPointsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    event: ['event', optional(lazy(() => loyaltyEventSchema))],
    events: ['events', optional(array(lazy(() => loyaltyEventSchema)))],
});

const adjustLoyaltyPointsRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    adjustPoints: ['adjust_points', lazy(() => loyaltyEventAdjustPointsSchema)],
    allowNegativeBalance: [
        'allow_negative_balance',
        optional(nullable(boolean())),
    ],
});

const adjustLoyaltyPointsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    event: ['event', optional(lazy(() => loyaltyEventSchema))],
});

const calculateLoyaltyPointsRequestSchema = object({
    orderId: ['order_id', optional(nullable(string()))],
    transactionAmountMoney: [
        'transaction_amount_money',
        optional(lazy(() => moneySchema)),
    ],
    loyaltyAccountId: ['loyalty_account_id', optional(nullable(string()))],
});

const calculateLoyaltyPointsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    points: ['points', optional(number())],
    promotionPoints: ['promotion_points', optional(number())],
});

const loyaltyPromotionAvailableTimeDataSchema = object({
    startDate: ['start_date', optional(string())],
    endDate: ['end_date', optional(string())],
    timePeriods: ['time_periods', array(string())],
});

const loyaltyPromotionIncentivePointsAdditionDataSchema = object({ pointsAddition: ['points_addition', number()] });

const loyaltyPromotionIncentivePointsMultiplierDataSchema = object({
    pointsMultiplier: ['points_multiplier', optional(nullable(number()))],
    multiplier: ['multiplier', optional(nullable(string()))],
});

const loyaltyPromotionIncentiveSchema = object({
    type: ['type', string()],
    pointsMultiplierData: [
        'points_multiplier_data',
        optional(lazy(() => loyaltyPromotionIncentivePointsMultiplierDataSchema)),
    ],
    pointsAdditionData: [
        'points_addition_data',
        optional(lazy(() => loyaltyPromotionIncentivePointsAdditionDataSchema)),
    ],
});

const loyaltyPromotionTriggerLimitSchema = object({ times: ['times', number()], interval: ['interval', optional(string())] });

const loyaltyPromotionSchema = object({
    id: ['id', optional(string())],
    name: ['name', string()],
    incentive: ['incentive', lazy(() => loyaltyPromotionIncentiveSchema)],
    availableTime: [
        'available_time',
        lazy(() => loyaltyPromotionAvailableTimeDataSchema),
    ],
    triggerLimit: [
        'trigger_limit',
        optional(lazy(() => loyaltyPromotionTriggerLimitSchema)),
    ],
    status: ['status', optional(string())],
    createdAt: ['created_at', optional(string())],
    canceledAt: ['canceled_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    loyaltyProgramId: ['loyalty_program_id', optional(string())],
    minimumSpendAmountMoney: [
        'minimum_spend_amount_money',
        optional(lazy(() => moneySchema)),
    ],
    qualifyingItemVariationIds: [
        'qualifying_item_variation_ids',
        optional(nullable(array(string()))),
    ],
    qualifyingCategoryIds: [
        'qualifying_category_ids',
        optional(nullable(array(string()))),
    ],
});

const cancelLoyaltyPromotionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    loyaltyPromotion: [
        'loyalty_promotion',
        optional(lazy(() => loyaltyPromotionSchema)),
    ],
});

const loyaltyAccountExpiringPointDeadlineSchema = object({ points: ['points', number()], expiresAt: ['expires_at', string()] });

const loyaltyAccountMappingSchema = object({
    id: ['id', optional(string())],
    createdAt: ['created_at', optional(string())],
    phoneNumber: ['phone_number', optional(nullable(string()))],
});

const loyaltyAccountSchema = object({
    id: ['id', optional(string())],
    programId: ['program_id', string()],
    balance: ['balance', optional(number())],
    lifetimePoints: ['lifetime_points', optional(number())],
    customerId: ['customer_id', optional(nullable(string()))],
    enrolledAt: ['enrolled_at', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    mapping: ['mapping', optional(lazy(() => loyaltyAccountMappingSchema))],
    expiringPointDeadlines: [
        'expiring_point_deadlines',
        optional(nullable(array(lazy(() => loyaltyAccountExpiringPointDeadlineSchema)))),
    ],
});

const createLoyaltyAccountRequestSchema = object({
    loyaltyAccount: ['loyalty_account', lazy(() => loyaltyAccountSchema)],
    idempotencyKey: ['idempotency_key', string()],
});

const createLoyaltyAccountResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    loyaltyAccount: [
        'loyalty_account',
        optional(lazy(() => loyaltyAccountSchema)),
    ],
});

const createLoyaltyPromotionRequestSchema = object({
    loyaltyPromotion: ['loyalty_promotion', lazy(() => loyaltyPromotionSchema)],
    idempotencyKey: ['idempotency_key', string()],
});

const createLoyaltyPromotionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    loyaltyPromotion: [
        'loyalty_promotion',
        optional(lazy(() => loyaltyPromotionSchema)),
    ],
});

const loyaltyRewardSchema = object({
    id: ['id', optional(string())],
    status: ['status', optional(string())],
    loyaltyAccountId: ['loyalty_account_id', string()],
    rewardTierId: ['reward_tier_id', string()],
    points: ['points', optional(number())],
    orderId: ['order_id', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    redeemedAt: ['redeemed_at', optional(string())],
});

const createLoyaltyRewardRequestSchema = object({
    reward: ['reward', lazy(() => loyaltyRewardSchema)],
    idempotencyKey: ['idempotency_key', string()],
});

const createLoyaltyRewardResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    reward: ['reward', optional(lazy(() => loyaltyRewardSchema))],
});

const deleteLoyaltyRewardResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const loyaltyProgramAccrualRuleCategoryDataSchema = object({ categoryId: ['category_id', string()] });

const loyaltyProgramAccrualRuleItemVariationDataSchema = object({ itemVariationId: ['item_variation_id', string()] });

const loyaltyProgramAccrualRuleSpendDataSchema = object({
    amountMoney: ['amount_money', lazy(() => moneySchema)],
    excludedCategoryIds: [
        'excluded_category_ids',
        optional(nullable(array(string()))),
    ],
    excludedItemVariationIds: [
        'excluded_item_variation_ids',
        optional(nullable(array(string()))),
    ],
    taxMode: ['tax_mode', string()],
});

const loyaltyProgramAccrualRuleVisitDataSchema = object({
    minimumAmountMoney: [
        'minimum_amount_money',
        optional(lazy(() => moneySchema)),
    ],
    taxMode: ['tax_mode', string()],
});

const loyaltyProgramAccrualRuleSchema = object({
    accrualType: ['accrual_type', string()],
    points: ['points', optional(nullable(number()))],
    visitData: [
        'visit_data',
        optional(lazy(() => loyaltyProgramAccrualRuleVisitDataSchema)),
    ],
    spendData: [
        'spend_data',
        optional(lazy(() => loyaltyProgramAccrualRuleSpendDataSchema)),
    ],
    itemVariationData: [
        'item_variation_data',
        optional(lazy(() => loyaltyProgramAccrualRuleItemVariationDataSchema)),
    ],
    categoryData: [
        'category_data',
        optional(lazy(() => loyaltyProgramAccrualRuleCategoryDataSchema)),
    ],
});

const loyaltyProgramExpirationPolicySchema = object({ expirationDuration: ['expiration_duration', string()] });

const catalogObjectReferenceSchema = object({
    objectId: ['object_id', optional(nullable(string()))],
    catalogVersion: ['catalog_version', optional(nullable(bigint()))],
});

const loyaltyProgramRewardDefinitionSchema = object({
    scope: ['scope', string()],
    discountType: ['discount_type', string()],
    percentageDiscount: ['percentage_discount', optional(string())],
    catalogObjectIds: ['catalog_object_ids', optional(array(string()))],
    fixedDiscountMoney: [
        'fixed_discount_money',
        optional(lazy(() => moneySchema)),
    ],
    maxDiscountMoney: ['max_discount_money', optional(lazy(() => moneySchema))],
});

const loyaltyProgramRewardTierSchema = object({
    id: ['id', optional(string())],
    points: ['points', number()],
    name: ['name', optional(string())],
    definition: [
        'definition',
        optional(lazy(() => loyaltyProgramRewardDefinitionSchema)),
    ],
    createdAt: ['created_at', optional(string())],
    pricingRuleReference: [
        'pricing_rule_reference',
        lazy(() => catalogObjectReferenceSchema),
    ],
});

const loyaltyProgramTerminologySchema = object({ one: ['one', string()], other: ['other', string()] });

const loyaltyProgramSchema = object({
    id: ['id', optional(string())],
    status: ['status', optional(string())],
    rewardTiers: [
        'reward_tiers',
        optional(nullable(array(lazy(() => loyaltyProgramRewardTierSchema)))),
    ],
    expirationPolicy: [
        'expiration_policy',
        optional(lazy(() => loyaltyProgramExpirationPolicySchema)),
    ],
    terminology: [
        'terminology',
        optional(lazy(() => loyaltyProgramTerminologySchema)),
    ],
    locationIds: ['location_ids', optional(nullable(array(string())))],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    accrualRules: [
        'accrual_rules',
        optional(nullable(array(lazy(() => loyaltyProgramAccrualRuleSchema)))),
    ],
});

const listLoyaltyProgramsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    programs: ['programs', optional(array(lazy(() => loyaltyProgramSchema)))],
});

const listLoyaltyPromotionsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    loyaltyPromotions: [
        'loyalty_promotions',
        optional(array(lazy(() => loyaltyPromotionSchema))),
    ],
    cursor: ['cursor', optional(string())],
});

const redeemLoyaltyRewardRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    locationId: ['location_id', string()],
});

const redeemLoyaltyRewardResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    event: ['event', optional(lazy(() => loyaltyEventSchema))],
});

const retrieveLoyaltyAccountResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    loyaltyAccount: [
        'loyalty_account',
        optional(lazy(() => loyaltyAccountSchema)),
    ],
});

const retrieveLoyaltyProgramResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    program: ['program', optional(lazy(() => loyaltyProgramSchema))],
});

const retrieveLoyaltyPromotionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    loyaltyPromotion: [
        'loyalty_promotion',
        optional(lazy(() => loyaltyPromotionSchema)),
    ],
});

const retrieveLoyaltyRewardResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    reward: ['reward', optional(lazy(() => loyaltyRewardSchema))],
});

const searchLoyaltyAccountsRequestLoyaltyAccountQuerySchema = object({
    mappings: [
        'mappings',
        optional(nullable(array(lazy(() => loyaltyAccountMappingSchema)))),
    ],
    customerIds: ['customer_ids', optional(nullable(array(string())))],
});

const searchLoyaltyAccountsRequestSchema = object({
    query: [
        'query',
        optional(lazy(() => searchLoyaltyAccountsRequestLoyaltyAccountQuerySchema)),
    ],
    limit: ['limit', optional(number())],
    cursor: ['cursor', optional(string())],
});

const searchLoyaltyAccountsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    loyaltyAccounts: [
        'loyalty_accounts',
        optional(array(lazy(() => loyaltyAccountSchema))),
    ],
    cursor: ['cursor', optional(string())],
});

const loyaltyEventDateTimeFilterSchema = object({ createdAt: ['created_at', lazy(() => timeRangeSchema)] });

const loyaltyEventLocationFilterSchema = object({ locationIds: ['location_ids', array(string())] });

const loyaltyEventLoyaltyAccountFilterSchema = object({ loyaltyAccountId: ['loyalty_account_id', string()] });

const loyaltyEventOrderFilterSchema = object({ orderId: ['order_id', string()] });

const loyaltyEventTypeFilterSchema = object({ types: ['types', array(string())] });

const loyaltyEventFilterSchema = object({
    loyaltyAccountFilter: [
        'loyalty_account_filter',
        optional(lazy(() => loyaltyEventLoyaltyAccountFilterSchema)),
    ],
    typeFilter: [
        'type_filter',
        optional(lazy(() => loyaltyEventTypeFilterSchema)),
    ],
    dateTimeFilter: [
        'date_time_filter',
        optional(lazy(() => loyaltyEventDateTimeFilterSchema)),
    ],
    locationFilter: [
        'location_filter',
        optional(lazy(() => loyaltyEventLocationFilterSchema)),
    ],
    orderFilter: [
        'order_filter',
        optional(lazy(() => loyaltyEventOrderFilterSchema)),
    ],
});

const loyaltyEventQuerySchema = object({
    filter: ['filter', optional(lazy(() => loyaltyEventFilterSchema))],
});

const searchLoyaltyEventsRequestSchema = object({
    query: ['query', optional(lazy(() => loyaltyEventQuerySchema))],
    limit: ['limit', optional(number())],
    cursor: ['cursor', optional(string())],
});

const searchLoyaltyEventsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    events: ['events', optional(array(lazy(() => loyaltyEventSchema)))],
    cursor: ['cursor', optional(string())],
});

const searchLoyaltyRewardsRequestLoyaltyRewardQuerySchema = object({
    loyaltyAccountId: ['loyalty_account_id', string()],
    status: ['status', optional(string())],
});

const searchLoyaltyRewardsRequestSchema = object({
    query: [
        'query',
        optional(lazy(() => searchLoyaltyRewardsRequestLoyaltyRewardQuerySchema)),
    ],
    limit: ['limit', optional(number())],
    cursor: ['cursor', optional(string())],
});

const searchLoyaltyRewardsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    rewards: ['rewards', optional(array(lazy(() => loyaltyRewardSchema)))],
    cursor: ['cursor', optional(string())],
});

class LoyaltyApi extends BaseApi {
    /**
     * Creates a loyalty account. To create a loyalty account, you must provide the `program_id` and a
     * `mapping` with the `phone_number` of the buyer.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                           See the corresponding object definition for field
     *                                                           details.
     * @return Response from the API call
     */
    async createLoyaltyAccount(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/loyalty/accounts');
        const mapped = req.prepareArgs({
            body: [body, createLoyaltyAccountRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createLoyaltyAccountResponseSchema, requestOptions);
    }
    /**
     * Searches for loyalty accounts in a loyalty program.
     *
     * You can search for a loyalty account using the phone number or customer ID associated with the
     * account. To return all loyalty accounts, specify an empty `query` object or omit it entirely.
     *
     * Search results are sorted by `created_at` in ascending order.
     *
     * @param body         An object containing the fields to POST for the
     *                                                            request.  See the corresponding object definition for
     *                                                            field details.
     * @return Response from the API call
     */
    async searchLoyaltyAccounts(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/loyalty/accounts/search');
        const mapped = req.prepareArgs({
            body: [body, searchLoyaltyAccountsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchLoyaltyAccountsResponseSchema, requestOptions);
    }
    /**
     * Retrieves a loyalty account.
     *
     * @param accountId  The ID of the [loyalty account](entity:LoyaltyAccount) to retrieve.
     * @return Response from the API call
     */
    async retrieveLoyaltyAccount(accountId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ accountId: [accountId, string()] });
        req.appendTemplatePath `/v2/loyalty/accounts/${mapped.accountId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveLoyaltyAccountResponseSchema, requestOptions);
    }
    /**
     * Adds points earned from a purchase to a [loyalty account]($m/LoyaltyAccount).
     *
     * - If you are using the Orders API to manage orders, provide the `order_id`. Square reads the order
     * to compute the points earned from both the base loyalty program and an associated
     * [loyalty promotion]($m/LoyaltyPromotion). For purchases that qualify for multiple accrual
     * rules, Square computes points based on the accrual rule that grants the most points.
     * For purchases that qualify for multiple promotions, Square computes points based on the most
     * recently created promotion. A purchase must first qualify for program points to be eligible for
     * promotion points.
     *
     * - If you are not using the Orders API to manage orders, provide `points` with the number of points
     * to add.
     * You must first perform a client-side computation of the points earned from the loyalty program and
     * loyalty promotion. For spend-based and visit-based programs, you can call
     * [CalculateLoyaltyPoints]($e/Loyalty/CalculateLoyaltyPoints)
     * to compute the points earned from the base loyalty program. For information about computing points
     * earned from a loyalty promotion, see
     * [Calculating promotion points](https://developer.squareup.com/docs/loyalty-api/loyalty-
     * promotions#calculate-promotion-points).
     *
     * @param accountId    The ID of the target [loyalty account](entity:
     *                                                              LoyaltyAccount).
     * @param body         An object containing the fields to POST for the
     *                                                              request.  See the corresponding object definition for
     *                                                              field details.
     * @return Response from the API call
     */
    async accumulateLoyaltyPoints(accountId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            accountId: [accountId, string()],
            body: [body, accumulateLoyaltyPointsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/loyalty/accounts/${mapped.accountId}/accumulate`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(accumulateLoyaltyPointsResponseSchema, requestOptions);
    }
    /**
     * Adds points to or subtracts points from a buyer's account.
     *
     * Use this endpoint only when you need to manually adjust points. Otherwise, in your application flow,
     * you call
     * [AccumulateLoyaltyPoints]($e/Loyalty/AccumulateLoyaltyPoints)
     * to add points when a buyer pays for the purchase.
     *
     * @param accountId    The ID of the target [loyalty account](entity:
     *                                                          LoyaltyAccount).
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async adjustLoyaltyPoints(accountId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            accountId: [accountId, string()],
            body: [body, adjustLoyaltyPointsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/loyalty/accounts/${mapped.accountId}/adjust`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(adjustLoyaltyPointsResponseSchema, requestOptions);
    }
    /**
     * Searches for loyalty events.
     *
     * A Square loyalty program maintains a ledger of events that occur during the lifetime of a
     * buyer's loyalty account. Each change in the point balance
     * (for example, points earned, points redeemed, and points expired) is
     * recorded in the ledger. Using this endpoint, you can search the ledger for events.
     *
     * Search results are sorted by `created_at` in descending order.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async searchLoyaltyEvents(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/loyalty/events/search');
        const mapped = req.prepareArgs({
            body: [body, searchLoyaltyEventsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchLoyaltyEventsResponseSchema, requestOptions);
    }
    /**
     * Returns a list of loyalty programs in the seller's account.
     * Loyalty programs define how buyers can earn points and redeem points for rewards. Square sellers can
     * have only one loyalty program, which is created and managed from the Seller Dashboard. For more
     * information, see [Loyalty Program Overview](https://developer.squareup.com/docs/loyalty/overview).
     *
     *
     * Replaced with [RetrieveLoyaltyProgram](api-endpoint:Loyalty-RetrieveLoyaltyProgram) when used with
     * the keyword `main`.
     *
     * @return Response from the API call
     * @deprecated
     */
    async listLoyaltyPrograms(requestOptions) {
        const req = this.createRequest('GET', '/v2/loyalty/programs');
        req.deprecated('LoyaltyApi.listLoyaltyPrograms');
        req.authenticate([{ global: true }]);
        return req.callAsJson(listLoyaltyProgramsResponseSchema, requestOptions);
    }
    /**
     * Retrieves the loyalty program in a seller's account, specified by the program ID or the keyword
     * `main`.
     *
     * Loyalty programs define how buyers can earn points and redeem points for rewards. Square sellers can
     * have only one loyalty program, which is created and managed from the Seller Dashboard. For more
     * information, see [Loyalty Program Overview](https://developer.squareup.com/docs/loyalty/overview).
     *
     * @param programId  The ID of the loyalty program or the keyword `main`. Either value can be used to
     *                             retrieve the single loyalty program that belongs to the seller.
     * @return Response from the API call
     */
    async retrieveLoyaltyProgram(programId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ programId: [programId, string()] });
        req.appendTemplatePath `/v2/loyalty/programs/${mapped.programId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveLoyaltyProgramResponseSchema, requestOptions);
    }
    /**
     * Calculates the number of points a buyer can earn from a purchase. Applications might call this
     * endpoint
     * to display the points to the buyer.
     *
     * - If you are using the Orders API to manage orders, provide the `order_id` and (optional)
     * `loyalty_account_id`.
     * Square reads the order to compute the points earned from the base loyalty program and an associated
     * [loyalty promotion]($m/LoyaltyPromotion).
     *
     * - If you are not using the Orders API to manage orders, provide `transaction_amount_money` with the
     * purchase amount. Square uses this amount to calculate the points earned from the base loyalty
     * program,
     * but not points earned from a loyalty promotion. For spend-based and visit-based programs, the
     * `tax_mode`
     * setting of the accrual rule indicates how taxes should be treated for loyalty points accrual.
     * If the purchase qualifies for program points, call
     * [ListLoyaltyPromotions]($e/Loyalty/ListLoyaltyPromotions) and perform a client-side computation
     * to calculate whether the purchase also qualifies for promotion points. For more information, see
     * [Calculating promotion points](https://developer.squareup.com/docs/loyalty-api/loyalty-
     * promotions#calculate-promotion-points).
     *
     * @param programId    The ID of the [loyalty program](entity:
     *                                                             LoyaltyProgram), which defines the rules for accruing
     *                                                             points.
     * @param body         An object containing the fields to POST for the
     *                                                             request.  See the corresponding object definition for
     *                                                             field details.
     * @return Response from the API call
     */
    async calculateLoyaltyPoints(programId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            programId: [programId, string()],
            body: [body, calculateLoyaltyPointsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/loyalty/programs/${mapped.programId}/calculate`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(calculateLoyaltyPointsResponseSchema, requestOptions);
    }
    /**
     * Lists the loyalty promotions associated with a [loyalty program]($m/LoyaltyProgram).
     * Results are sorted by the `created_at` date in descending order (newest to oldest).
     *
     * @param programId  The ID of the base [loyalty program](entity:LoyaltyProgram). To get the program ID,
     *                             call [RetrieveLoyaltyProgram](api-endpoint:Loyalty-RetrieveLoyaltyProgram) using the
     *                             `main` keyword.
     * @param status     The status to filter the results by. If a status is provided, only loyalty promotions
     *                             with the specified status are returned. Otherwise, all loyalty promotions associated
     *                             with the loyalty program are returned.
     * @param cursor     The cursor returned in the paged response from the previous call to this endpoint.
     *                             Provide this cursor to retrieve the next page of results for your original request.
     *                             For more information, see [Pagination](https://developer.squareup.com/docs/build-
     *                             basics/common-api-patterns/pagination).
     * @param limit      The maximum number of results to return in a single paged response. The minimum value
     *                             is 1 and the maximum value is 30. The default value is 30. For more information, see
     *                             [Pagination](https://developer.squareup.com/docs/build-basics/common-api-
     *                             patterns/pagination).
     * @return Response from the API call
     */
    async listLoyaltyPromotions(programId, status, cursor, limit, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            programId: [programId, string()],
            status: [status, optional(string())],
            cursor: [cursor, optional(string())],
            limit: [limit, optional(number())],
        });
        req.query('status', mapped.status);
        req.query('cursor', mapped.cursor);
        req.query('limit', mapped.limit);
        req.appendTemplatePath `/v2/loyalty/programs/${mapped.programId}/promotions`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(listLoyaltyPromotionsResponseSchema, requestOptions);
    }
    /**
     * Creates a loyalty promotion for a [loyalty program]($m/LoyaltyProgram). A loyalty promotion
     * enables buyers to earn points in addition to those earned from the base loyalty program.
     *
     * This endpoint sets the loyalty promotion to the `ACTIVE` or `SCHEDULED` status, depending on the
     * `available_time` setting. A loyalty program can have a maximum of 10 loyalty promotions with an
     * `ACTIVE` or `SCHEDULED` status.
     *
     * @param programId    The ID of the [loyalty program](entity:
     *                                                             LoyaltyProgram) to associate with the promotion. To
     *                                                             get the program ID, call [RetrieveLoyaltyProgram](api-
     *                                                             endpoint:Loyalty-RetrieveLoyaltyProgram) using the
     *                                                             `main` keyword.
     * @param body         An object containing the fields to POST for the
     *                                                             request.  See the corresponding object definition for
     *                                                             field details.
     * @return Response from the API call
     */
    async createLoyaltyPromotion(programId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            programId: [programId, string()],
            body: [body, createLoyaltyPromotionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/loyalty/programs/${mapped.programId}/promotions`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(createLoyaltyPromotionResponseSchema, requestOptions);
    }
    /**
     * Retrieves a loyalty promotion.
     *
     * @param promotionId  The ID of the [loyalty promotion](entity:LoyaltyPromotion) to retrieve.
     * @param programId    The ID of the base [loyalty program](entity:LoyaltyProgram). To get the program ID,
     *                               call [RetrieveLoyaltyProgram](api-endpoint:Loyalty-RetrieveLoyaltyProgram) using the
     *                               `main` keyword.
     * @return Response from the API call
     */
    async retrieveLoyaltyPromotion(promotionId, programId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            promotionId: [promotionId, string()],
            programId: [programId, string()],
        });
        req.appendTemplatePath `/v2/loyalty/programs/${mapped.programId}/promotions/${mapped.promotionId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveLoyaltyPromotionResponseSchema, requestOptions);
    }
    /**
     * Cancels a loyalty promotion. Use this endpoint to cancel an `ACTIVE` promotion earlier than the
     * end date, cancel an `ACTIVE` promotion when an end date is not specified, or cancel a `SCHEDULED`
     * promotion.
     * Because updating a promotion is not supported, you can also use this endpoint to cancel a promotion
     * before
     * you create a new one.
     *
     * This endpoint sets the loyalty promotion to the `CANCELED` state
     *
     * @param promotionId  The ID of the [loyalty promotion](entity:LoyaltyPromotion) to cancel. You can
     *                               cancel a promotion that has an `ACTIVE` or `SCHEDULED` status.
     * @param programId    The ID of the base [loyalty program](entity:LoyaltyProgram).
     * @return Response from the API call
     */
    async cancelLoyaltyPromotion(promotionId, programId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            promotionId: [promotionId, string()],
            programId: [programId, string()],
        });
        req.appendTemplatePath `/v2/loyalty/programs/${mapped.programId}/promotions/${mapped.promotionId}/cancel`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(cancelLoyaltyPromotionResponseSchema, requestOptions);
    }
    /**
     * Creates a loyalty reward. In the process, the endpoint does following:
     *
     * - Uses the `reward_tier_id` in the request to determine the number of points
     * to lock for this reward.
     * - If the request includes `order_id`, it adds the reward and related discount to the order.
     *
     * After a reward is created, the points are locked and
     * not available for the buyer to redeem another reward.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async createLoyaltyReward(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/loyalty/rewards');
        const mapped = req.prepareArgs({
            body: [body, createLoyaltyRewardRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createLoyaltyRewardResponseSchema, requestOptions);
    }
    /**
     * Searches for loyalty rewards. This endpoint accepts a request with no query filters and returns
     * results for all loyalty accounts.
     * If you include a `query` object, `loyalty_account_id` is required and `status` is  optional.
     *
     * If you know a reward ID, use the
     * [RetrieveLoyaltyReward]($e/Loyalty/RetrieveLoyaltyReward) endpoint.
     *
     * Search results are sorted by `updated_at` in descending order.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                           See the corresponding object definition for field
     *                                                           details.
     * @return Response from the API call
     */
    async searchLoyaltyRewards(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/loyalty/rewards/search');
        const mapped = req.prepareArgs({
            body: [body, searchLoyaltyRewardsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchLoyaltyRewardsResponseSchema, requestOptions);
    }
    /**
     * Deletes a loyalty reward by doing the following:
     *
     * - Returns the loyalty points back to the loyalty account.
     * - If an order ID was specified when the reward was created
     * (see [CreateLoyaltyReward]($e/Loyalty/CreateLoyaltyReward)),
     * it updates the order by removing the reward and related
     * discounts.
     *
     * You cannot delete a reward that has reached the terminal state (REDEEMED).
     *
     * @param rewardId  The ID of the [loyalty reward](entity:LoyaltyReward) to delete.
     * @return Response from the API call
     */
    async deleteLoyaltyReward(rewardId, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({ rewardId: [rewardId, string()] });
        req.appendTemplatePath `/v2/loyalty/rewards/${mapped.rewardId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteLoyaltyRewardResponseSchema, requestOptions);
    }
    /**
     * Retrieves a loyalty reward.
     *
     * @param rewardId  The ID of the [loyalty reward](entity:LoyaltyReward) to retrieve.
     * @return Response from the API call
     */
    async retrieveLoyaltyReward(rewardId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ rewardId: [rewardId, string()] });
        req.appendTemplatePath `/v2/loyalty/rewards/${mapped.rewardId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveLoyaltyRewardResponseSchema, requestOptions);
    }
    /**
     * Redeems a loyalty reward.
     *
     * The endpoint sets the reward to the `REDEEMED` terminal state.
     *
     * If you are using your own order processing system (not using the
     * Orders API), you call this endpoint after the buyer paid for the
     * purchase.
     *
     * After the reward reaches the terminal state, it cannot be deleted.
     * In other words, points used for the reward cannot be returned
     * to the account.
     *
     * @param rewardId     The ID of the [loyalty reward](entity:LoyaltyReward) to
     *                                                          redeem.
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async redeemLoyaltyReward(rewardId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            rewardId: [rewardId, string()],
            body: [body, redeemLoyaltyRewardRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/loyalty/rewards/${mapped.rewardId}/redeem`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(redeemLoyaltyRewardResponseSchema, requestOptions);
    }
}

const bulkDeleteMerchantCustomAttributesRequestMerchantCustomAttributeDeleteRequestSchema = object({ key: ['key', optional(string())] });

const bulkDeleteMerchantCustomAttributesRequestSchema = object({
    values: [
        'values',
        dict(lazy(() => bulkDeleteMerchantCustomAttributesRequestMerchantCustomAttributeDeleteRequestSchema)),
    ],
});

const bulkDeleteMerchantCustomAttributesResponseMerchantCustomAttributeDeleteResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const bulkDeleteMerchantCustomAttributesResponseSchema = object({
    values: [
        'values',
        dict(lazy(() => bulkDeleteMerchantCustomAttributesResponseMerchantCustomAttributeDeleteResponseSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkUpsertMerchantCustomAttributesRequestMerchantCustomAttributeUpsertRequestSchema = object({
    merchantId: ['merchant_id', string()],
    customAttribute: ['custom_attribute', lazy(() => customAttributeSchema)],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const bulkUpsertMerchantCustomAttributesRequestSchema = object({
    values: [
        'values',
        dict(lazy(() => bulkUpsertMerchantCustomAttributesRequestMerchantCustomAttributeUpsertRequestSchema)),
    ],
});

const bulkUpsertMerchantCustomAttributesResponseMerchantCustomAttributeUpsertResponseSchema = object({
    merchantId: ['merchant_id', optional(string())],
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkUpsertMerchantCustomAttributesResponseSchema = object({
    values: [
        'values',
        optional(dict(lazy(() => bulkUpsertMerchantCustomAttributesResponseMerchantCustomAttributeUpsertResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const createMerchantCustomAttributeDefinitionRequestSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        lazy(() => customAttributeDefinitionSchema),
    ],
    idempotencyKey: ['idempotency_key', optional(string())],
});

const createMerchantCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const deleteMerchantCustomAttributeDefinitionResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const deleteMerchantCustomAttributeResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const listMerchantCustomAttributeDefinitionsResponseSchema = object({
    customAttributeDefinitions: [
        'custom_attribute_definitions',
        optional(array(lazy(() => customAttributeDefinitionSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const listMerchantCustomAttributesResponseSchema = object({
    customAttributes: [
        'custom_attributes',
        optional(array(lazy(() => customAttributeSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveMerchantCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveMerchantCustomAttributeResponseSchema = object({
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateMerchantCustomAttributeDefinitionRequestSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        lazy(() => customAttributeDefinitionSchema),
    ],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const updateMerchantCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const upsertMerchantCustomAttributeRequestSchema = object({
    customAttribute: ['custom_attribute', lazy(() => customAttributeSchema)],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const upsertMerchantCustomAttributeResponseSchema = object({
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class MerchantCustomAttributesApi extends BaseApi {
    /**
     * Lists the merchant-related [custom attribute definitions]($m/CustomAttributeDefinition) that belong
     * to a Square seller account.
     * When all response pages are retrieved, the results include all custom attribute definitions
     * that are visible to the requesting application, including those that are created by other
     * applications and set to `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param visibilityFilter  Filters the `CustomAttributeDefinition` results by their `visibility` values.
     * @param limit             The maximum number of results to return in a single paged response. This limit
     *                                    is advisory. The response might contain more or fewer results. The minimum
     *                                    value is 1 and the maximum value is 100. The default value is 20. For more
     *                                    information, see [Pagination](https://developer.squareup.com/docs/build-
     *                                    basics/common-api-patterns/pagination).
     * @param cursor            The cursor returned in the paged response from the previous call to this
     *                                    endpoint. Provide this cursor to retrieve the next page of results for your
     *                                    original request. For more information, see [Pagination](https://developer.
     *                                    squareup.com/docs/build-basics/common-api-patterns/pagination).
     * @return Response from the API call
     */
    async listMerchantCustomAttributeDefinitions(visibilityFilter, limit, cursor, requestOptions) {
        const req = this.createRequest('GET', '/v2/merchants/custom-attribute-definitions');
        const mapped = req.prepareArgs({
            visibilityFilter: [visibilityFilter, optional(string())],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
        });
        req.query('visibility_filter', mapped.visibilityFilter);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listMerchantCustomAttributeDefinitionsResponseSchema, requestOptions);
    }
    /**
     * Creates a merchant-related [custom attribute definition]($m/CustomAttributeDefinition) for a Square
     * seller account.
     * Use this endpoint to define a custom attribute that can be associated with a merchant connecting to
     * your application.
     * A custom attribute definition specifies the `key`, `visibility`, `schema`, and other properties
     * for a custom attribute. After the definition is created, you can call
     * [UpsertMerchantCustomAttribute]($e/MerchantCustomAttributes/UpsertMerchantCustomAttribute) or
     * [BulkUpsertMerchantCustomAttributes]($e/MerchantCustomAttributes/BulkUpsertMerchantCustomAttributes)
     * to set the custom attribute for a merchant.
     *
     * @param body         An object containing the fields to
     *                                                                              POST for the request.  See the
     *                                                                              corresponding object definition for
     *                                                                              field details.
     * @return Response from the API call
     */
    async createMerchantCustomAttributeDefinition(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/merchants/custom-attribute-definitions');
        const mapped = req.prepareArgs({
            body: [body, createMerchantCustomAttributeDefinitionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createMerchantCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Deletes a merchant-related [custom attribute definition]($m/CustomAttributeDefinition) from a Square
     * seller account.
     * Deleting a custom attribute definition also deletes the corresponding custom attribute from
     * the merchant.
     * Only the definition owner can delete a custom attribute definition.
     *
     * @param key The key of the custom attribute definition to delete.
     * @return Response from the API call
     */
    async deleteMerchantCustomAttributeDefinition(key, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({ key: [key, string()] });
        req.appendTemplatePath `/v2/merchants/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteMerchantCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Retrieves a merchant-related [custom attribute definition]($m/CustomAttributeDefinition) from a
     * Square seller account.
     * To retrieve a custom attribute definition created by another application, the `visibility`
     * setting must be `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param key     The key of the custom attribute definition to retrieve. If the requesting application is
     *                          not the definition owner, you must use the qualified key.
     * @param version The current version of the custom attribute definition, which is used for strongly
     *                          consistent reads to guarantee that you receive the most up-to-date data. When included in
     *                          the request, Square returns the specified version or a higher version if one exists. If
     *                          the specified version is higher than the current version, Square returns a `BAD_REQUEST`
     *                          error.
     * @return Response from the API call
     */
    async retrieveMerchantCustomAttributeDefinition(key, version, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            key: [key, string()],
            version: [version, optional(number())],
        });
        req.query('version', mapped.version);
        req.appendTemplatePath `/v2/merchants/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveMerchantCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Updates a merchant-related [custom attribute definition]($m/CustomAttributeDefinition) for a Square
     * seller account.
     * Use this endpoint to update the following fields: `name`, `description`, `visibility`, or the
     * `schema` for a `Selection` data type.
     * Only the definition owner can update a custom attribute definition.
     *
     * @param key          The key of the custom attribute
     *                                                                              definition to update.
     * @param body         An object containing the fields to
     *                                                                              POST for the request.  See the
     *                                                                              corresponding object definition for
     *                                                                              field details.
     * @return Response from the API call
     */
    async updateMerchantCustomAttributeDefinition(key, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            key: [key, string()],
            body: [body, updateMerchantCustomAttributeDefinitionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/merchants/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateMerchantCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Deletes [custom attributes]($m/CustomAttribute) for a merchant as a bulk operation.
     * To delete a custom attribute owned by another application, the `visibility` setting must be
     * `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param body         An object containing the fields to POST
     *                                                                         for the request.  See the corresponding
     *                                                                         object definition for field details.
     * @return Response from the API call
     */
    async bulkDeleteMerchantCustomAttributes(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/merchants/custom-attributes/bulk-delete');
        const mapped = req.prepareArgs({
            body: [body, bulkDeleteMerchantCustomAttributesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkDeleteMerchantCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Creates or updates [custom attributes]($m/CustomAttribute) for a merchant as a bulk operation.
     * Use this endpoint to set the value of one or more custom attributes for a merchant.
     * A custom attribute is based on a custom attribute definition in a Square seller account, which is
     * created using the
     * [CreateMerchantCustomAttributeDefinition]($e/MerchantCustomAttributes/CreateMerchantCustomAttributeD
     * efinition) endpoint.
     * This `BulkUpsertMerchantCustomAttributes` endpoint accepts a map of 1 to 25 individual upsert
     * requests and returns a map of individual upsert responses. Each upsert request has a unique ID
     * and provides a merchant ID and custom attribute. Each upsert response is returned with the ID
     * of the corresponding request.
     * To create or update a custom attribute owned by another application, the `visibility` setting
     * must be `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param body         An object containing the fields to POST
     *                                                                         for the request.  See the corresponding
     *                                                                         object definition for field details.
     * @return Response from the API call
     */
    async bulkUpsertMerchantCustomAttributes(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/merchants/custom-attributes/bulk-upsert');
        const mapped = req.prepareArgs({
            body: [body, bulkUpsertMerchantCustomAttributesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkUpsertMerchantCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Lists the [custom attributes]($m/CustomAttribute) associated with a merchant.
     * You can use the `with_definitions` query parameter to also retrieve custom attribute definitions
     * in the same call.
     * When all response pages are retrieved, the results include all custom attributes that are
     * visible to the requesting application, including those that are owned by other applications
     * and set to `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param merchantId        The ID of the target [merchant](entity:Merchant).
     * @param visibilityFilter  Filters the `CustomAttributeDefinition` results by their `visibility` values.
     * @param limit             The maximum number of results to return in a single paged response. This
     *                                     limit is advisory. The response might contain more or fewer results. The
     *                                     minimum value is 1 and the maximum value is 100. The default value is 20. For
     *                                     more information, see [Pagination](https://developer.squareup.com/docs/build-
     *                                     basics/common-api-patterns/pagination).
     * @param cursor            The cursor returned in the paged response from the previous call to this
     *                                     endpoint. Provide this cursor to retrieve the next page of results for your
     *                                     original request. For more information, see [Pagination](https://developer.
     *                                     squareup.com/docs/build-basics/common-api-patterns/pagination).
     * @param withDefinitions   Indicates whether to return the [custom attribute definition](entity:
     *                                     CustomAttributeDefinition) in the `definition` field of each custom attribute.
     *                                     Set this parameter to `true` to get the name and description of each custom
     *                                     attribute, information about the data type, or other definition details. The
     *                                     default value is `false`.
     * @return Response from the API call
     */
    async listMerchantCustomAttributes(merchantId, visibilityFilter, limit, cursor, withDefinitions, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            merchantId: [merchantId, string()],
            visibilityFilter: [visibilityFilter, optional(string())],
            limit: [limit, optional(number())],
            cursor: [cursor, optional(string())],
            withDefinitions: [withDefinitions, optional(boolean())],
        });
        req.query('visibility_filter', mapped.visibilityFilter);
        req.query('limit', mapped.limit);
        req.query('cursor', mapped.cursor);
        req.query('with_definitions', mapped.withDefinitions);
        req.appendTemplatePath `/v2/merchants/${mapped.merchantId}/custom-attributes`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(listMerchantCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Deletes a [custom attribute]($m/CustomAttribute) associated with a merchant.
     * To delete a custom attribute owned by another application, the `visibility` setting must be
     * `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param merchantId  The ID of the target [merchant](entity:Merchant).
     * @param key         The key of the custom attribute to delete. This key must match the `key` of a custom
     *                              attribute definition in the Square seller account. If the requesting application is
     *                              not the definition owner, you must use the qualified key.
     * @return Response from the API call
     */
    async deleteMerchantCustomAttribute(merchantId, key, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            merchantId: [merchantId, string()],
            key: [key, string()],
        });
        req.appendTemplatePath `/v2/merchants/${mapped.merchantId}/custom-attributes/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteMerchantCustomAttributeResponseSchema, requestOptions);
    }
    /**
     * Retrieves a [custom attribute]($m/CustomAttribute) associated with a merchant.
     * You can use the `with_definition` query parameter to also retrieve the custom attribute definition
     * in the same call.
     * To retrieve a custom attribute owned by another application, the `visibility` setting must be
     * `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param merchantId      The ID of the target [merchant](entity:Merchant).
     * @param key             The key of the custom attribute to retrieve. This key must match the `key` of a
     *                                   custom attribute definition in the Square seller account. If the requesting
     *                                   application is not the definition owner, you must use the qualified key.
     * @param withDefinition  Indicates whether to return the [custom attribute definition](entity:
     *                                   CustomAttributeDefinition) in the `definition` field of the custom attribute.
     *                                   Set this parameter to `true` to get the name and description of the custom
     *                                   attribute, information about the data type, or other definition details. The
     *                                   default value is `false`.
     * @param version         The current version of the custom attribute, which is used for strongly
     *                                   consistent reads to guarantee that you receive the most up-to-date data. When
     *                                   included in the request, Square returns the specified version or a higher
     *                                   version if one exists. If the specified version is higher than the current
     *                                   version, Square returns a `BAD_REQUEST` error.
     * @return Response from the API call
     */
    async retrieveMerchantCustomAttribute(merchantId, key, withDefinition, version, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            merchantId: [merchantId, string()],
            key: [key, string()],
            withDefinition: [withDefinition, optional(boolean())],
            version: [version, optional(number())],
        });
        req.query('with_definition', mapped.withDefinition);
        req.query('version', mapped.version);
        req.appendTemplatePath `/v2/merchants/${mapped.merchantId}/custom-attributes/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveMerchantCustomAttributeResponseSchema, requestOptions);
    }
    /**
     * Creates or updates a [custom attribute]($m/CustomAttribute) for a merchant.
     * Use this endpoint to set the value of a custom attribute for a specified merchant.
     * A custom attribute is based on a custom attribute definition in a Square seller account, which
     * is created using the
     * [CreateMerchantCustomAttributeDefinition]($e/MerchantCustomAttributes/CreateMerchantCustomAttributeD
     * efinition) endpoint.
     * To create or update a custom attribute owned by another application, the `visibility` setting
     * must be `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param merchantId   The ID of the target [merchant](entity:
     *                                                                    Merchant).
     * @param key          The key of the custom attribute to create or
     *                                                                    update. This key must match the `key` of a
     *                                                                    custom attribute definition in the Square
     *                                                                    seller account. If the requesting application
     *                                                                    is not the definition owner, you must use the
     *                                                                    qualified key.
     * @param body         An object containing the fields to POST for
     *                                                                    the request.  See the corresponding object
     *                                                                    definition for field details.
     * @return Response from the API call
     */
    async upsertMerchantCustomAttribute(merchantId, key, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            merchantId: [merchantId, string()],
            key: [key, string()],
            body: [body, upsertMerchantCustomAttributeRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/merchants/${mapped.merchantId}/custom-attributes/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(upsertMerchantCustomAttributeResponseSchema, requestOptions);
    }
}

const merchantSchema = object({
    id: ['id', optional(string())],
    businessName: ['business_name', optional(nullable(string()))],
    country: ['country', string()],
    languageCode: ['language_code', optional(nullable(string()))],
    currency: ['currency', optional(string())],
    status: ['status', optional(string())],
    mainLocationId: ['main_location_id', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
});

const listMerchantsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    merchant: ['merchant', optional(array(lazy(() => merchantSchema)))],
    cursor: ['cursor', optional(number())],
});

const retrieveMerchantResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    merchant: ['merchant', optional(lazy(() => merchantSchema))],
});

class MerchantsApi extends BaseApi {
    /**
     * Provides details about the merchant associated with a given access token.
     *
     * The access token used to connect your application to a Square seller is associated
     * with a single merchant. That means that `ListMerchants` returns a list
     * with a single `Merchant` object. You can specify your personal access token
     * to get your own merchant information or specify an OAuth token to get the
     * information for the merchant that granted your application access.
     *
     * If you know the merchant ID, you can also use the [RetrieveMerchant]($e/Merchants/RetrieveMerchant)
     * endpoint to retrieve the merchant information.
     *
     * @param cursor The cursor generated by the previous response.
     * @return Response from the API call
     */
    async listMerchants(cursor, requestOptions) {
        const req = this.createRequest('GET', '/v2/merchants');
        const mapped = req.prepareArgs({ cursor: [cursor, optional(number())] });
        req.query('cursor', mapped.cursor);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listMerchantsResponseSchema, requestOptions);
    }
    /**
     * Retrieves the `Merchant` object for the given `merchant_id`.
     *
     * @param merchantId  The ID of the merchant to retrieve. If the string "me" is supplied as the ID, then
     *                              retrieve the merchant that is currently accessible to this call.
     * @return Response from the API call
     */
    async retrieveMerchant(merchantId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ merchantId: [merchantId, string()] });
        req.appendTemplatePath `/v2/merchants/${mapped.merchantId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveMerchantResponseSchema, requestOptions);
    }
}

const createMobileAuthorizationCodeRequestSchema = object({ locationId: ['location_id', optional(string())] });

const createMobileAuthorizationCodeResponseSchema = object({
    authorizationCode: ['authorization_code', optional(string())],
    expiresAt: ['expires_at', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class MobileAuthorizationApi extends BaseApi {
    /**
     * Generates code to authorize a mobile application to connect to a Square card reader.
     *
     * Authorization codes are one-time-use codes and expire 60 minutes after being issued.
     *
     * __Important:__ The `Authorization` header you provide to this endpoint must have the following
     * format:
     *
     * ```
     * Authorization: Bearer ACCESS_TOKEN
     * ```
     *
     * Replace `ACCESS_TOKEN` with a
     * [valid production authorization credential](https://developer.squareup.com/docs/build-basics/access-
     * tokens).
     *
     * @param body         An object containing the fields to POST for
     *                                                                    the request.  See the corresponding object
     *                                                                    definition for field details.
     * @return Response from the API call
     */
    async createMobileAuthorizationCode(body, requestOptions) {
        const req = this.createRequest('POST', '/mobile/authorization-code');
        const mapped = req.prepareArgs({
            body: [body, createMobileAuthorizationCodeRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createMobileAuthorizationCodeResponseSchema, requestOptions);
    }
}

const obtainTokenRequestSchema = object({
    clientId: ['client_id', string()],
    clientSecret: ['client_secret', optional(nullable(string()))],
    code: ['code', optional(nullable(string()))],
    redirectUri: ['redirect_uri', optional(nullable(string()))],
    grantType: ['grant_type', string()],
    refreshToken: ['refresh_token', optional(nullable(string()))],
    migrationToken: ['migration_token', optional(nullable(string()))],
    scopes: ['scopes', optional(nullable(array(string())))],
    shortLived: ['short_lived', optional(nullable(boolean()))],
    codeVerifier: ['code_verifier', optional(nullable(string()))],
});

const obtainTokenResponseSchema = object({
    accessToken: ['access_token', optional(string())],
    tokenType: ['token_type', optional(string())],
    expiresAt: ['expires_at', optional(string())],
    merchantId: ['merchant_id', optional(string())],
    subscriptionId: ['subscription_id', optional(string())],
    planId: ['plan_id', optional(string())],
    idToken: ['id_token', optional(string())],
    refreshToken: ['refresh_token', optional(string())],
    shortLived: ['short_lived', optional(boolean())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    refreshTokenExpiresAt: ['refresh_token_expires_at', optional(string())],
});

const retrieveTokenStatusResponseSchema = object({
    scopes: ['scopes', optional(array(string()))],
    expiresAt: ['expires_at', optional(string())],
    clientId: ['client_id', optional(string())],
    merchantId: ['merchant_id', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const revokeTokenRequestSchema = object({
    clientId: ['client_id', optional(nullable(string()))],
    accessToken: ['access_token', optional(nullable(string()))],
    merchantId: ['merchant_id', optional(nullable(string()))],
    revokeOnlyAccessToken: [
        'revoke_only_access_token',
        optional(nullable(boolean())),
    ],
});

const revokeTokenResponseSchema = object({
    success: ['success', optional(boolean())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class OAuthApi extends BaseApi {
    /**
     * Revokes an access token generated with the OAuth flow.
     *
     * If an account has more than one OAuth access token for your application, this
     * endpoint revokes all of them, regardless of which token you specify.
     *
     * __Important:__ The `Authorization` header for this endpoint must have the
     * following format:
     *
     * ```
     * Authorization: Client APPLICATION_SECRET
     * ```
     *
     * Replace `APPLICATION_SECRET` with the application secret on the **OAuth**
     * page for your application in the Developer Dashboard.
     *
     * @param body          An object containing the fields to POST for the request.  See
     *                                                   the corresponding object definition for field details.
     * @param authorization Client APPLICATION_SECRET
     * @return Response from the API call
     */
    async revokeToken(body, authorization, requestOptions) {
        const req = this.createRequest('POST', '/oauth2/revoke');
        const mapped = req.prepareArgs({
            body: [body, revokeTokenRequestSchema],
            authorization: [authorization, string()],
        });
        req.header('Content-Type', 'application/json');
        req.header('Authorization', mapped.authorization);
        req.json(mapped.body);
        req.authenticate(false);
        return req.callAsJson(revokeTokenResponseSchema, requestOptions);
    }
    /**
     * Returns an OAuth access token and a refresh token unless the
     * `short_lived` parameter is set to `true`, in which case the endpoint
     * returns only an access token.
     *
     * The `grant_type` parameter specifies the type of OAuth request. If
     * `grant_type` is `authorization_code`, you must include the authorization
     * code you received when a seller granted you authorization. If `grant_type`
     * is `refresh_token`, you must provide a valid refresh token. If you're using
     * an old version of the Square APIs (prior to March 13, 2019), `grant_type`
     * can be `migration_token` and you must provide a valid migration token.
     *
     * You can use the `scopes` parameter to limit the set of permissions granted
     * to the access token and refresh token. You can use the `short_lived` parameter
     * to create an access token that expires in 24 hours.
     *
     * __Note:__ OAuth tokens should be encrypted and stored on a secure server.
     * Application clients should never interact directly with OAuth tokens.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                  the corresponding object definition for field details.
     * @return Response from the API call
     */
    async obtainToken(body, requestOptions) {
        const req = this.createRequest('POST', '/oauth2/token');
        const mapped = req.prepareArgs({ body: [body, obtainTokenRequestSchema] });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate(false);
        return req.callAsJson(obtainTokenResponseSchema, requestOptions);
    }
    /**
     * Returns information about an [OAuth access token](https://developer.squareup.com/docs/build-
     * basics/access-tokens#get-an-oauth-access-token) or an application’s [personal access token](https:
     * //developer.squareup.com/docs/build-basics/access-tokens#get-a-personal-access-token).
     *
     * Add the access token to the Authorization header of the request.
     *
     * __Important:__ The `Authorization` header you provide to this endpoint must have the following
     * format:
     *
     * ```
     * Authorization: Bearer ACCESS_TOKEN
     * ```
     *
     * where `ACCESS_TOKEN` is a
     * [valid production authorization credential](https://developer.squareup.com/docs/build-basics/access-
     * tokens).
     *
     * If the access token is expired or not a valid access token, the endpoint returns an `UNAUTHORIZED`
     * error.
     *
     * @return Response from the API call
     */
    async retrieveTokenStatus(requestOptions) {
        const req = this.createRequest('POST', '/oauth2/token/status');
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveTokenStatusResponseSchema, requestOptions);
    }
}

const bulkDeleteOrderCustomAttributesRequestDeleteCustomAttributeSchema = object({ key: ['key', optional(string())], orderId: ['order_id', string()] });

const bulkDeleteOrderCustomAttributesRequestSchema = object({
    values: [
        'values',
        dict(lazy(() => bulkDeleteOrderCustomAttributesRequestDeleteCustomAttributeSchema)),
    ],
});

const deleteOrderCustomAttributeResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const bulkDeleteOrderCustomAttributesResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    values: [
        'values',
        dict(lazy(() => deleteOrderCustomAttributeResponseSchema)),
    ],
});

const bulkUpsertOrderCustomAttributesRequestUpsertCustomAttributeSchema = object({
    customAttribute: ['custom_attribute', lazy(() => customAttributeSchema)],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
    orderId: ['order_id', string()],
});

const bulkUpsertOrderCustomAttributesRequestSchema = object({
    values: [
        'values',
        dict(lazy(() => bulkUpsertOrderCustomAttributesRequestUpsertCustomAttributeSchema)),
    ],
});

const upsertOrderCustomAttributeResponseSchema = object({
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkUpsertOrderCustomAttributesResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    values: [
        'values',
        dict(lazy(() => upsertOrderCustomAttributeResponseSchema)),
    ],
});

const createOrderCustomAttributeDefinitionRequestSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        lazy(() => customAttributeDefinitionSchema),
    ],
    idempotencyKey: ['idempotency_key', optional(string())],
});

const createOrderCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const deleteOrderCustomAttributeDefinitionResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const listOrderCustomAttributeDefinitionsResponseSchema = object({
    customAttributeDefinitions: [
        'custom_attribute_definitions',
        array(lazy(() => customAttributeDefinitionSchema)),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const listOrderCustomAttributesResponseSchema = object({
    customAttributes: [
        'custom_attributes',
        optional(array(lazy(() => customAttributeSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveOrderCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveOrderCustomAttributeResponseSchema = object({
    customAttribute: [
        'custom_attribute',
        optional(lazy(() => customAttributeSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateOrderCustomAttributeDefinitionRequestSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        lazy(() => customAttributeDefinitionSchema),
    ],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const updateOrderCustomAttributeDefinitionResponseSchema = object({
    customAttributeDefinition: [
        'custom_attribute_definition',
        optional(lazy(() => customAttributeDefinitionSchema)),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const upsertOrderCustomAttributeRequestSchema = object({
    customAttribute: ['custom_attribute', lazy(() => customAttributeSchema)],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

class OrderCustomAttributesApi extends BaseApi {
    /**
     * Lists the order-related [custom attribute definitions]($m/CustomAttributeDefinition) that belong to
     * a Square seller account.
     *
     * When all response pages are retrieved, the results include all custom attribute definitions
     * that are visible to the requesting application, including those that are created by other
     * applications and set to `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`. Note that
     * seller-defined custom attributes (also known as custom fields) are always set to
     * `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param visibilityFilter  Requests that all of the custom attributes be returned, or only those that are
     *                                    read-only or read-write.
     * @param cursor            The cursor returned in the paged response from the previous call to this
     *                                    endpoint.  Provide this cursor to retrieve the next page of results for your
     *                                    original request.  For more information, see [Pagination](https://developer.
     *                                    squareup.com/docs/working-with-apis/pagination).
     * @param limit             The maximum number of results to return in a single paged response. This limit
     *                                    is advisory.  The response might contain more or fewer results. The minimum
     *                                    value is 1 and the maximum value is 100.  The default value is 20. For more
     *                                    information, see [Pagination](https://developer.squareup.com/docs/working-with-
     *                                    apis/pagination).
     * @return Response from the API call
     */
    async listOrderCustomAttributeDefinitions(visibilityFilter, cursor, limit, requestOptions) {
        const req = this.createRequest('GET', '/v2/orders/custom-attribute-definitions');
        const mapped = req.prepareArgs({
            visibilityFilter: [visibilityFilter, optional(string())],
            cursor: [cursor, optional(string())],
            limit: [limit, optional(number())],
        });
        req.query('visibility_filter', mapped.visibilityFilter);
        req.query('cursor', mapped.cursor);
        req.query('limit', mapped.limit);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listOrderCustomAttributeDefinitionsResponseSchema, requestOptions);
    }
    /**
     * Creates an order-related custom attribute definition.  Use this endpoint to
     * define a custom attribute that can be associated with orders.
     *
     * After creating a custom attribute definition, you can set the custom attribute for orders
     * in the Square seller account.
     *
     * @param body         An object containing the fields to POST
     *                                                                           for the request.  See the corresponding
     *                                                                           object definition for field details.
     * @return Response from the API call
     */
    async createOrderCustomAttributeDefinition(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/orders/custom-attribute-definitions');
        const mapped = req.prepareArgs({
            body: [body, createOrderCustomAttributeDefinitionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createOrderCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Deletes an order-related [custom attribute definition]($m/CustomAttributeDefinition) from a Square
     * seller account.
     *
     * Only the definition owner can delete a custom attribute definition.
     *
     * @param key The key of the custom attribute definition to delete.
     * @return Response from the API call
     */
    async deleteOrderCustomAttributeDefinition(key, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({ key: [key, string()] });
        req.appendTemplatePath `/v2/orders/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteOrderCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Retrieves an order-related [custom attribute definition]($m/CustomAttributeDefinition) from a Square
     * seller account.
     *
     * To retrieve a custom attribute definition created by another application, the `visibility`
     * setting must be `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`. Note that seller-defined
     * custom attributes
     * (also known as custom fields) are always set to `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param key     The key of the custom attribute definition to retrieve.
     * @param version To enable [optimistic concurrency](https://developer.squareup.com/docs/build-
     *                          basics/common-api-patterns/optimistic-concurrency) control, include this optional field
     *                          and specify the current version of the custom attribute.
     * @return Response from the API call
     */
    async retrieveOrderCustomAttributeDefinition(key, version, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            key: [key, string()],
            version: [version, optional(number())],
        });
        req.query('version', mapped.version);
        req.appendTemplatePath `/v2/orders/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveOrderCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Updates an order-related custom attribute definition for a Square seller account.
     *
     * Only the definition owner can update a custom attribute definition. Note that sellers can view all
     * custom attributes in exported customer data, including those set to `VISIBILITY_HIDDEN`.
     *
     * @param key          The key of the custom attribute
     *                                                                           definition to update.
     * @param body         An object containing the fields to POST
     *                                                                           for the request.  See the corresponding
     *                                                                           object definition for field details.
     * @return Response from the API call
     */
    async updateOrderCustomAttributeDefinition(key, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            key: [key, string()],
            body: [body, updateOrderCustomAttributeDefinitionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/orders/custom-attribute-definitions/${mapped.key}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateOrderCustomAttributeDefinitionResponseSchema, requestOptions);
    }
    /**
     * Deletes order [custom attributes]($m/CustomAttribute) as a bulk operation.
     *
     * Use this endpoint to delete one or more custom attributes from one or more orders.
     * A custom attribute is based on a custom attribute definition in a Square seller account.  (To create
     * a
     * custom attribute definition, use the
     * [CreateOrderCustomAttributeDefinition]($e/OrderCustomAttributes/CreateOrderCustomAttributeDefinition
     * ) endpoint.)
     *
     * This `BulkDeleteOrderCustomAttributes` endpoint accepts a map of 1 to 25 individual delete
     * requests and returns a map of individual delete responses. Each delete request has a unique ID
     * and provides an order ID and custom attribute. Each delete response is returned with the ID
     * of the corresponding request.
     *
     * To delete a custom attribute owned by another application, the `visibility` setting
     * must be `VISIBILITY_READ_WRITE_VALUES`. Note that seller-defined custom attributes
     * (also known as custom fields) are always set to `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param body         An object containing the fields to POST for
     *                                                                      the request.  See the corresponding object
     *                                                                      definition for field details.
     * @return Response from the API call
     */
    async bulkDeleteOrderCustomAttributes(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/orders/custom-attributes/bulk-delete');
        const mapped = req.prepareArgs({
            body: [body, bulkDeleteOrderCustomAttributesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkDeleteOrderCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Creates or updates order [custom attributes]($m/CustomAttribute) as a bulk operation.
     *
     * Use this endpoint to delete one or more custom attributes from one or more orders.
     * A custom attribute is based on a custom attribute definition in a Square seller account.  (To create
     * a
     * custom attribute definition, use the
     * [CreateOrderCustomAttributeDefinition]($e/OrderCustomAttributes/CreateOrderCustomAttributeDefinition
     * ) endpoint.)
     *
     * This `BulkUpsertOrderCustomAttributes` endpoint accepts a map of 1 to 25 individual upsert
     * requests and returns a map of individual upsert responses. Each upsert request has a unique ID
     * and provides an order ID and custom attribute. Each upsert response is returned with the ID
     * of the corresponding request.
     *
     * To create or update a custom attribute owned by another application, the `visibility` setting
     * must be `VISIBILITY_READ_WRITE_VALUES`. Note that seller-defined custom attributes
     * (also known as custom fields) are always set to `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param body         An object containing the fields to POST for
     *                                                                      the request.  See the corresponding object
     *                                                                      definition for field details.
     * @return Response from the API call
     */
    async bulkUpsertOrderCustomAttributes(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/orders/custom-attributes/bulk-upsert');
        const mapped = req.prepareArgs({
            body: [body, bulkUpsertOrderCustomAttributesRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkUpsertOrderCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Lists the [custom attributes]($m/CustomAttribute) associated with an order.
     *
     * You can use the `with_definitions` query parameter to also retrieve custom attribute definitions
     * in the same call.
     *
     * When all response pages are retrieved, the results include all custom attributes that are
     * visible to the requesting application, including those that are owned by other applications
     * and set to `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param orderId           The ID of the target [order](entity:Order).
     * @param visibilityFilter  Requests that all of the custom attributes be returned, or only those that
     *                                     are read-only or read-write.
     * @param cursor            The cursor returned in the paged response from the previous call to this
     *                                     endpoint.  Provide this cursor to retrieve the next page of results for your
     *                                     original request.  For more information, see [Pagination](https://developer.
     *                                     squareup.com/docs/working-with-apis/pagination).
     * @param limit             The maximum number of results to return in a single paged response. This
     *                                     limit is advisory.  The response might contain more or fewer results. The
     *                                     minimum value is 1 and the maximum value is 100.  The default value is 20. For
     *                                     more information, see [Pagination](https://developer.squareup.com/docs/working-
     *                                     with-apis/pagination).
     * @param withDefinitions   Indicates whether to return the [custom attribute definition](entity:
     *                                     CustomAttributeDefinition) in the `definition` field of each custom attribute.
     *                                     Set this parameter to `true` to get the name and description of each custom
     *                                     attribute,  information about the data type, or other definition details. The
     *                                     default value is `false`.
     * @return Response from the API call
     */
    async listOrderCustomAttributes(orderId, visibilityFilter, cursor, limit, withDefinitions, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            orderId: [orderId, string()],
            visibilityFilter: [visibilityFilter, optional(string())],
            cursor: [cursor, optional(string())],
            limit: [limit, optional(number())],
            withDefinitions: [withDefinitions, optional(boolean())],
        });
        req.query('visibility_filter', mapped.visibilityFilter);
        req.query('cursor', mapped.cursor);
        req.query('limit', mapped.limit);
        req.query('with_definitions', mapped.withDefinitions);
        req.appendTemplatePath `/v2/orders/${mapped.orderId}/custom-attributes`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(listOrderCustomAttributesResponseSchema, requestOptions);
    }
    /**
     * Deletes a [custom attribute]($m/CustomAttribute) associated with a customer profile.
     *
     * To delete a custom attribute owned by another application, the `visibility` setting must be
     * `VISIBILITY_READ_WRITE_VALUES`. Note that seller-defined custom attributes
     * (also known as custom fields) are always set to `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param orderId              The ID of the target [order](entity:Order).
     * @param customAttributeKey   The key of the custom attribute to delete.  This key must match the key of
     *                                       an existing custom attribute definition.
     * @return Response from the API call
     */
    async deleteOrderCustomAttribute(orderId, customAttributeKey, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            orderId: [orderId, string()],
            customAttributeKey: [customAttributeKey, string()],
        });
        req.appendTemplatePath `/v2/orders/${mapped.orderId}/custom-attributes/${mapped.customAttributeKey}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteOrderCustomAttributeResponseSchema, requestOptions);
    }
    /**
     * Retrieves a [custom attribute]($m/CustomAttribute) associated with an order.
     *
     * You can use the `with_definition` query parameter to also retrieve the custom attribute definition
     * in the same call.
     *
     * To retrieve a custom attribute owned by another application, the `visibility` setting must be
     * `VISIBILITY_READ_ONLY` or `VISIBILITY_READ_WRITE_VALUES`. Note that seller-defined custom
     * attributes
     * also known as custom fields) are always set to `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param orderId              The ID of the target [order](entity:Order).
     * @param customAttributeKey   The key of the custom attribute to retrieve.  This key must match the key
     *                                        of an existing custom attribute definition.
     * @param version              To enable [optimistic concurrency](https://developer.squareup.
     *                                        com/docs/build-basics/common-api-patterns/optimistic-concurrency) control,
     *                                        include this optional field and specify the current version of the custom
     *                                        attribute.
     * @param withDefinition       Indicates whether to return the [custom attribute definition](entity:
     *                                        CustomAttributeDefinition) in the `definition` field of each  custom
     *                                        attribute. Set this parameter to `true` to get the name and description of
     *                                        each custom attribute,  information about the data type, or other
     *                                        definition details. The default value is `false`.
     * @return Response from the API call
     */
    async retrieveOrderCustomAttribute(orderId, customAttributeKey, version, withDefinition, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            orderId: [orderId, string()],
            customAttributeKey: [customAttributeKey, string()],
            version: [version, optional(number())],
            withDefinition: [withDefinition, optional(boolean())],
        });
        req.query('version', mapped.version);
        req.query('with_definition', mapped.withDefinition);
        req.appendTemplatePath `/v2/orders/${mapped.orderId}/custom-attributes/${mapped.customAttributeKey}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveOrderCustomAttributeResponseSchema, requestOptions);
    }
    /**
     * Creates or updates a [custom attribute]($m/CustomAttribute) for an order.
     *
     * Use this endpoint to set the value of a custom attribute for a specific order.
     * A custom attribute is based on a custom attribute definition in a Square seller account. (To create
     * a
     * custom attribute definition, use the
     * [CreateOrderCustomAttributeDefinition]($e/OrderCustomAttributes/CreateOrderCustomAttributeDefinition
     * ) endpoint.)
     *
     * To create or update a custom attribute owned by another application, the `visibility` setting
     * must be `VISIBILITY_READ_WRITE_VALUES`. Note that seller-defined custom attributes
     * (also known as custom fields) are always set to `VISIBILITY_READ_WRITE_VALUES`.
     *
     * @param orderId              The ID of the target [order](entity:
     *                                                                         Order).
     * @param customAttributeKey   The key of the custom attribute to create
     *                                                                         or update.  This key must match the key
     *                                                                         of an existing custom attribute definition.
     * @param body                 An object containing the fields to POST
     *                                                                         for the request.  See the corresponding
     *                                                                         object definition for field details.
     * @return Response from the API call
     */
    async upsertOrderCustomAttribute(orderId, customAttributeKey, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            orderId: [orderId, string()],
            customAttributeKey: [customAttributeKey, string()],
            body: [body, upsertOrderCustomAttributeRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/orders/${mapped.orderId}/custom-attributes/${mapped.customAttributeKey}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(upsertOrderCustomAttributeResponseSchema, requestOptions);
    }
}

const batchRetrieveOrdersRequestSchema = object({
    locationId: ['location_id', optional(nullable(string()))],
    orderIds: ['order_ids', array(string())],
});

const batchRetrieveOrdersResponseSchema = object({
    orders: ['orders', optional(array(lazy(() => orderSchema)))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const calculateOrderRequestSchema = object({
    order: ['order', lazy(() => orderSchema)],
    proposedRewards: [
        'proposed_rewards',
        optional(nullable(array(lazy(() => orderRewardSchema)))),
    ],
});

const calculateOrderResponseSchema = object({
    order: ['order', optional(lazy(() => orderSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const cloneOrderRequestSchema = object({
    orderId: ['order_id', string()],
    version: ['version', optional(number())],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const cloneOrderResponseSchema = object({
    order: ['order', optional(lazy(() => orderSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const createOrderResponseSchema = object({
    order: ['order', optional(lazy(() => orderSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const payOrderRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    orderVersion: ['order_version', optional(nullable(number()))],
    paymentIds: ['payment_ids', optional(nullable(array(string())))],
});

const payOrderResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    order: ['order', optional(lazy(() => orderSchema))],
});

const retrieveOrderResponseSchema = object({
    order: ['order', optional(lazy(() => orderSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const searchOrdersCustomerFilterSchema = object({ customerIds: ['customer_ids', optional(nullable(array(string())))] });

const searchOrdersDateTimeFilterSchema = object({
    createdAt: ['created_at', optional(lazy(() => timeRangeSchema))],
    updatedAt: ['updated_at', optional(lazy(() => timeRangeSchema))],
    closedAt: ['closed_at', optional(lazy(() => timeRangeSchema))],
});

const searchOrdersFulfillmentFilterSchema = object({
    fulfillmentTypes: [
        'fulfillment_types',
        optional(nullable(array(string()))),
    ],
    fulfillmentStates: [
        'fulfillment_states',
        optional(nullable(array(string()))),
    ],
});

const searchOrdersSourceFilterSchema = object({ sourceNames: ['source_names', optional(nullable(array(string())))] });

const searchOrdersStateFilterSchema = object({ states: ['states', array(string())] });

const searchOrdersFilterSchema = object({
    stateFilter: [
        'state_filter',
        optional(lazy(() => searchOrdersStateFilterSchema)),
    ],
    dateTimeFilter: [
        'date_time_filter',
        optional(lazy(() => searchOrdersDateTimeFilterSchema)),
    ],
    fulfillmentFilter: [
        'fulfillment_filter',
        optional(lazy(() => searchOrdersFulfillmentFilterSchema)),
    ],
    sourceFilter: [
        'source_filter',
        optional(lazy(() => searchOrdersSourceFilterSchema)),
    ],
    customerFilter: [
        'customer_filter',
        optional(lazy(() => searchOrdersCustomerFilterSchema)),
    ],
});

const searchOrdersSortSchema = object({
    sortField: ['sort_field', string()],
    sortOrder: ['sort_order', optional(string())],
});

const searchOrdersQuerySchema = object({
    filter: ['filter', optional(lazy(() => searchOrdersFilterSchema))],
    sort: ['sort', optional(lazy(() => searchOrdersSortSchema))],
});

const searchOrdersRequestSchema = object({
    locationIds: ['location_ids', optional(array(string()))],
    cursor: ['cursor', optional(string())],
    query: ['query', optional(lazy(() => searchOrdersQuerySchema))],
    limit: ['limit', optional(number())],
    returnEntries: ['return_entries', optional(boolean())],
});

const orderEntrySchema = object({
    orderId: ['order_id', optional(nullable(string()))],
    version: ['version', optional(number())],
    locationId: ['location_id', optional(nullable(string()))],
});

const searchOrdersResponseSchema = object({
    orderEntries: [
        'order_entries',
        optional(array(lazy(() => orderEntrySchema))),
    ],
    orders: ['orders', optional(array(lazy(() => orderSchema)))],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateOrderRequestSchema = object({
    order: ['order', optional(lazy(() => orderSchema))],
    fieldsToClear: ['fields_to_clear', optional(nullable(array(string())))],
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
});

const updateOrderResponseSchema = object({
    order: ['order', optional(lazy(() => orderSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class OrdersApi extends BaseApi {
    /**
     * Creates a new [order]($m/Order) that can include information about products for
     * purchase and settings to apply to the purchase.
     *
     * To pay for a created order, see
     * [Pay for Orders](https://developer.squareup.com/docs/orders-api/pay-for-orders).
     *
     * You can modify open orders using the [UpdateOrder]($e/Orders/UpdateOrder) endpoint.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                  the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createOrder(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/orders');
        const mapped = req.prepareArgs({ body: [body, createOrderRequestSchema] });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createOrderResponseSchema, requestOptions);
    }
    /**
     * Retrieves a set of [orders]($m/Order) by their IDs.
     *
     * If a given order ID does not exist, the ID is ignored instead of generating an error.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async batchRetrieveOrders(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/orders/batch-retrieve');
        const mapped = req.prepareArgs({
            body: [body, batchRetrieveOrdersRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(batchRetrieveOrdersResponseSchema, requestOptions);
    }
    /**
     * Enables applications to preview order pricing without creating an order.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                     the corresponding object definition for field details.
     * @return Response from the API call
     */
    async calculateOrder(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/orders/calculate');
        const mapped = req.prepareArgs({
            body: [body, calculateOrderRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(calculateOrderResponseSchema, requestOptions);
    }
    /**
     * Creates a new order, in the `DRAFT` state, by duplicating an existing order. The newly created order
     * has
     * only the core fields (such as line items, taxes, and discounts) copied from the original order.
     *
     * @param body         An object containing the fields to POST for the request.  See the
     *                                                 corresponding object definition for field details.
     * @return Response from the API call
     */
    async cloneOrder(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/orders/clone');
        const mapped = req.prepareArgs({ body: [body, cloneOrderRequestSchema] });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(cloneOrderResponseSchema, requestOptions);
    }
    /**
     * Search all orders for one or more locations. Orders include all sales,
     * returns, and exchanges regardless of how or when they entered the Square
     * ecosystem (such as Point of Sale, Invoices, and Connect APIs).
     *
     * `SearchOrders` requests need to specify which locations to search and define a
     * [SearchOrdersQuery]($m/SearchOrdersQuery) object that controls
     * how to sort or filter the results. Your `SearchOrdersQuery` can:
     *
     * Set filter criteria.
     * Set the sort order.
     * Determine whether to return results as complete `Order` objects or as
     * [OrderEntry]($m/OrderEntry) objects.
     *
     * Note that details for orders processed with Square Point of Sale while in
     * offline mode might not be transmitted to Square for up to 72 hours. Offline
     * orders have a `created_at` value that reflects the time the order was created,
     * not the time it was subsequently transmitted to Square.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                   the corresponding object definition for field details.
     * @return Response from the API call
     */
    async searchOrders(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/orders/search');
        const mapped = req.prepareArgs({ body: [body, searchOrdersRequestSchema] });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchOrdersResponseSchema, requestOptions);
    }
    /**
     * Retrieves an [Order]($m/Order) by ID.
     *
     * @param orderId  The ID of the order to retrieve.
     * @return Response from the API call
     */
    async retrieveOrder(orderId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ orderId: [orderId, string()] });
        req.appendTemplatePath `/v2/orders/${mapped.orderId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveOrderResponseSchema, requestOptions);
    }
    /**
     * Updates an open [order]($m/Order) by adding, replacing, or deleting
     * fields. Orders with a `COMPLETED` or `CANCELED` state cannot be updated.
     *
     * An `UpdateOrder` request requires the following:
     *
     * - The `order_id` in the endpoint path, identifying the order to update.
     * - The latest `version` of the order to update.
     * - The [sparse order](https://developer.squareup.com/docs/orders-api/manage-orders/update-
     * orders#sparse-order-objects)
     * containing only the fields to update and the version to which the update is
     * being applied.
     * - If deleting fields, the [dot notation paths](https://developer.squareup.com/docs/orders-api/manage-
     * orders/update-orders#identifying-fields-to-delete)
     * identifying the fields to clear.
     *
     * To pay for an order, see
     * [Pay for Orders](https://developer.squareup.com/docs/orders-api/pay-for-orders).
     *
     * @param orderId      The ID of the order to update.
     * @param body         An object containing the fields to POST for the request.  See
     *                                                  the corresponding object definition for field details.
     * @return Response from the API call
     */
    async updateOrder(orderId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            orderId: [orderId, string()],
            body: [body, updateOrderRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/orders/${mapped.orderId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateOrderResponseSchema, requestOptions);
    }
    /**
     * Pay for an [order]($m/Order) using one or more approved [payments]($m/Payment)
     * or settle an order with a total of `0`.
     *
     * The total of the `payment_ids` listed in the request must be equal to the order
     * total. Orders with a total amount of `0` can be marked as paid by specifying an empty
     * array of `payment_ids` in the request.
     *
     * To be used with `PayOrder`, a payment must:
     *
     * - Reference the order by specifying the `order_id` when [creating the
     * payment]($e/Payments/CreatePayment).
     * Any approved payments that reference the same `order_id` not specified in the
     * `payment_ids` is canceled.
     * - Be approved with [delayed capture](https://developer.squareup.com/docs/payments-api/take-
     * payments/card-payments/delayed-capture).
     * Using a delayed capture payment with `PayOrder` completes the approved payment.
     *
     * @param orderId      The ID of the order being paid.
     * @param body         An object containing the fields to POST for the request.  See the
     *                                               corresponding object definition for field details.
     * @return Response from the API call
     */
    async payOrder(orderId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            orderId: [orderId, string()],
            body: [body, payOrderRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/orders/${mapped.orderId}/pay`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(payOrderResponseSchema, requestOptions);
    }
}

const cancelPaymentByIdempotencyKeyRequestSchema = object({ idempotencyKey: ['idempotency_key', string()] });

const cancelPaymentByIdempotencyKeyResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const applicationDetailsSchema = object({
    squareProduct: ['square_product', optional(string())],
    applicationId: ['application_id', optional(nullable(string()))],
});

const aCHDetailsSchema = object({
    routingNumber: ['routing_number', optional(nullable(string()))],
    accountNumberSuffix: ['account_number_suffix', optional(nullable(string()))],
    accountType: ['account_type', optional(nullable(string()))],
});

const bankAccountPaymentDetailsSchema = object({
    bankName: ['bank_name', optional(nullable(string()))],
    transferType: ['transfer_type', optional(nullable(string()))],
    accountOwnershipType: [
        'account_ownership_type',
        optional(nullable(string())),
    ],
    fingerprint: ['fingerprint', optional(nullable(string()))],
    country: ['country', optional(nullable(string()))],
    statementDescription: [
        'statement_description',
        optional(nullable(string())),
    ],
    achDetails: ['ach_details', optional(lazy(() => aCHDetailsSchema))],
    errors: ['errors', optional(nullable(array(lazy(() => errorSchema))))],
});

const afterpayDetailsSchema = object({
    emailAddress: ['email_address', optional(nullable(string()))],
});

const clearpayDetailsSchema = object({
    emailAddress: ['email_address', optional(nullable(string()))],
});

const buyNowPayLaterDetailsSchema = object({
    brand: ['brand', optional(nullable(string()))],
    afterpayDetails: [
        'afterpay_details',
        optional(lazy(() => afterpayDetailsSchema)),
    ],
    clearpayDetails: [
        'clearpay_details',
        optional(lazy(() => clearpayDetailsSchema)),
    ],
});

const cardPaymentTimelineSchema = object({
    authorizedAt: ['authorized_at', optional(nullable(string()))],
    capturedAt: ['captured_at', optional(nullable(string()))],
    voidedAt: ['voided_at', optional(nullable(string()))],
});

const deviceDetailsSchema = object({
    deviceId: ['device_id', optional(nullable(string()))],
    deviceInstallationId: [
        'device_installation_id',
        optional(nullable(string())),
    ],
    deviceName: ['device_name', optional(nullable(string()))],
});

const cardPaymentDetailsSchema = object({
    status: ['status', optional(nullable(string()))],
    card: ['card', optional(lazy(() => cardSchema))],
    entryMethod: ['entry_method', optional(nullable(string()))],
    cvvStatus: ['cvv_status', optional(nullable(string()))],
    avsStatus: ['avs_status', optional(nullable(string()))],
    authResultCode: ['auth_result_code', optional(nullable(string()))],
    applicationIdentifier: [
        'application_identifier',
        optional(nullable(string())),
    ],
    applicationName: ['application_name', optional(nullable(string()))],
    applicationCryptogram: [
        'application_cryptogram',
        optional(nullable(string())),
    ],
    verificationMethod: ['verification_method', optional(nullable(string()))],
    verificationResults: ['verification_results', optional(nullable(string()))],
    statementDescription: ['statement_description', optional(nullable(string()))],
    deviceDetails: ['device_details', optional(lazy(() => deviceDetailsSchema))],
    cardPaymentTimeline: [
        'card_payment_timeline',
        optional(lazy(() => cardPaymentTimelineSchema)),
    ],
    refundRequiresCardPresence: [
        'refund_requires_card_presence',
        optional(nullable(boolean())),
    ],
    errors: ['errors', optional(nullable(array(lazy(() => errorSchema))))],
});

const cashPaymentDetailsSchema = object({
    buyerSuppliedMoney: ['buyer_supplied_money', lazy(() => moneySchema)],
    changeBackMoney: ['change_back_money', optional(lazy(() => moneySchema))],
});

const cashAppDetailsSchema = object({
    buyerFullName: ['buyer_full_name', optional(nullable(string()))],
    buyerCountryCode: ['buyer_country_code', optional(nullable(string()))],
    buyerCashtag: ['buyer_cashtag', optional(string())],
});

const digitalWalletDetailsSchema = object({
    status: ['status', optional(nullable(string()))],
    brand: ['brand', optional(nullable(string()))],
    cashAppDetails: [
        'cash_app_details',
        optional(lazy(() => cashAppDetailsSchema)),
    ],
});

const externalPaymentDetailsSchema = object({
    type: ['type', string()],
    source: ['source', string()],
    sourceId: ['source_id', optional(nullable(string()))],
    sourceFeeMoney: ['source_fee_money', optional(lazy(() => moneySchema))],
});

const offlinePaymentDetailsSchema = object({ clientCreatedAt: ['client_created_at', optional(string())] });

const processingFeeSchema = object({
    effectiveAt: ['effective_at', optional(nullable(string()))],
    type: ['type', optional(nullable(string()))],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
});

const riskEvaluationSchema = object({
    createdAt: ['created_at', optional(string())],
    riskLevel: ['risk_level', optional(string())],
});

const squareAccountDetailsSchema = object({
    paymentSourceToken: ['payment_source_token', optional(nullable(string()))],
    errors: ['errors', optional(nullable(array(lazy(() => errorSchema))))],
});

const paymentSchema = object({
    id: ['id', optional(string())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    tipMoney: ['tip_money', optional(lazy(() => moneySchema))],
    totalMoney: ['total_money', optional(lazy(() => moneySchema))],
    appFeeMoney: ['app_fee_money', optional(lazy(() => moneySchema))],
    approvedMoney: ['approved_money', optional(lazy(() => moneySchema))],
    processingFee: [
        'processing_fee',
        optional(array(lazy(() => processingFeeSchema))),
    ],
    refundedMoney: ['refunded_money', optional(lazy(() => moneySchema))],
    status: ['status', optional(string())],
    delayDuration: ['delay_duration', optional(string())],
    delayAction: ['delay_action', optional(nullable(string()))],
    delayedUntil: ['delayed_until', optional(string())],
    sourceType: ['source_type', optional(string())],
    cardDetails: ['card_details', optional(lazy(() => cardPaymentDetailsSchema))],
    cashDetails: ['cash_details', optional(lazy(() => cashPaymentDetailsSchema))],
    bankAccountDetails: [
        'bank_account_details',
        optional(lazy(() => bankAccountPaymentDetailsSchema)),
    ],
    externalDetails: [
        'external_details',
        optional(lazy(() => externalPaymentDetailsSchema)),
    ],
    walletDetails: [
        'wallet_details',
        optional(lazy(() => digitalWalletDetailsSchema)),
    ],
    buyNowPayLaterDetails: [
        'buy_now_pay_later_details',
        optional(lazy(() => buyNowPayLaterDetailsSchema)),
    ],
    squareAccountDetails: [
        'square_account_details',
        optional(lazy(() => squareAccountDetailsSchema)),
    ],
    locationId: ['location_id', optional(string())],
    orderId: ['order_id', optional(string())],
    referenceId: ['reference_id', optional(string())],
    customerId: ['customer_id', optional(string())],
    employeeId: ['employee_id', optional(string())],
    teamMemberId: ['team_member_id', optional(nullable(string()))],
    refundIds: ['refund_ids', optional(array(string()))],
    riskEvaluation: [
        'risk_evaluation',
        optional(lazy(() => riskEvaluationSchema)),
    ],
    terminalCheckoutId: ['terminal_checkout_id', optional(string())],
    buyerEmailAddress: ['buyer_email_address', optional(string())],
    billingAddress: ['billing_address', optional(lazy(() => addressSchema))],
    shippingAddress: ['shipping_address', optional(lazy(() => addressSchema))],
    note: ['note', optional(string())],
    statementDescriptionIdentifier: [
        'statement_description_identifier',
        optional(string()),
    ],
    capabilities: ['capabilities', optional(array(string()))],
    receiptNumber: ['receipt_number', optional(string())],
    receiptUrl: ['receipt_url', optional(string())],
    deviceDetails: ['device_details', optional(lazy(() => deviceDetailsSchema))],
    applicationDetails: [
        'application_details',
        optional(lazy(() => applicationDetailsSchema)),
    ],
    isOfflinePayment: ['is_offline_payment', optional(boolean())],
    offlinePaymentDetails: [
        'offline_payment_details',
        optional(lazy(() => offlinePaymentDetailsSchema)),
    ],
    versionToken: ['version_token', optional(nullable(string()))],
});

const cancelPaymentResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    payment: ['payment', optional(lazy(() => paymentSchema))],
});

const completePaymentRequestSchema = object({ versionToken: ['version_token', optional(nullable(string()))] });

const completePaymentResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    payment: ['payment', optional(lazy(() => paymentSchema))],
});

const customerDetailsSchema = object({
    customerInitiated: ['customer_initiated', optional(nullable(boolean()))],
    sellerKeyedIn: ['seller_keyed_in', optional(nullable(boolean()))],
});

const createPaymentRequestSchema = object({
    sourceId: ['source_id', string()],
    idempotencyKey: ['idempotency_key', string()],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    tipMoney: ['tip_money', optional(lazy(() => moneySchema))],
    appFeeMoney: ['app_fee_money', optional(lazy(() => moneySchema))],
    delayDuration: ['delay_duration', optional(string())],
    delayAction: ['delay_action', optional(string())],
    autocomplete: ['autocomplete', optional(boolean())],
    orderId: ['order_id', optional(string())],
    customerId: ['customer_id', optional(string())],
    locationId: ['location_id', optional(string())],
    teamMemberId: ['team_member_id', optional(string())],
    referenceId: ['reference_id', optional(string())],
    verificationToken: ['verification_token', optional(string())],
    acceptPartialAuthorization: [
        'accept_partial_authorization',
        optional(boolean()),
    ],
    buyerEmailAddress: ['buyer_email_address', optional(string())],
    billingAddress: ['billing_address', optional(lazy(() => addressSchema))],
    shippingAddress: ['shipping_address', optional(lazy(() => addressSchema))],
    note: ['note', optional(string())],
    statementDescriptionIdentifier: [
        'statement_description_identifier',
        optional(string()),
    ],
    cashDetails: ['cash_details', optional(lazy(() => cashPaymentDetailsSchema))],
    externalDetails: [
        'external_details',
        optional(lazy(() => externalPaymentDetailsSchema)),
    ],
    customerDetails: [
        'customer_details',
        optional(lazy(() => customerDetailsSchema)),
    ],
    offlinePaymentDetails: [
        'offline_payment_details',
        optional(lazy(() => offlinePaymentDetailsSchema)),
    ],
});

const createPaymentResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    payment: ['payment', optional(lazy(() => paymentSchema))],
});

const getPaymentResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    payment: ['payment', optional(lazy(() => paymentSchema))],
});

const listPaymentsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    payments: ['payments', optional(array(lazy(() => paymentSchema)))],
    cursor: ['cursor', optional(string())],
});

const updatePaymentRequestSchema = object({
    payment: ['payment', optional(lazy(() => paymentSchema))],
    idempotencyKey: ['idempotency_key', string()],
});

const updatePaymentResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    payment: ['payment', optional(lazy(() => paymentSchema))],
});

class PaymentsApi extends BaseApi {
    /**
     * Retrieves a list of payments taken by the account making the request.
     *
     * Results are eventually consistent, and new payments or changes to payments might take several
     * seconds to appear.
     *
     * The maximum results per page is 100.
     *
     * @param beginTime          Indicates the start of the time range to retrieve payments for, in RFC 3339
     *                                      format.   The range is determined using the `created_at` field for each
     *                                      Payment. Inclusive. Default: The current time minus one year.
     * @param endTime            Indicates the end of the time range to retrieve payments for, in RFC 3339
     *                                      format.  The  range is determined using the `created_at` field for each
     *                                      Payment.  Default: The current time.
     * @param sortOrder          The order in which results are listed by `Payment.created_at`: - `ASC` -
     *                                      Oldest to newest. - `DESC` - Newest to oldest (default).
     * @param cursor             A pagination cursor returned by a previous call to this endpoint. Provide
     *                                      this cursor to retrieve the next set of results for the original query.  For
     *                                      more information, see [Pagination](https://developer.squareup.com/docs/build-
     *                                      basics/common-api-patterns/pagination).
     * @param locationId         Limit results to the location supplied. By default, results are returned for
     *                                      the default (main) location associated with the seller.
     * @param total              The exact amount in the `total_money` for a payment.
     * @param last4              The last four digits of a payment card.
     * @param cardBrand          The brand of the payment card (for example, VISA).
     * @param limit              The maximum number of results to be returned in a single page. It is
     *                                      possible to receive fewer results than the specified limit on a given page.
     *                                      The default value of 100 is also the maximum allowed value. If the provided
     *                                      value is  greater than 100, it is ignored and the default value is used
     *                                      instead.  Default: `100`
     * @param isOfflinePayment   Whether the payment was taken offline or not.
     * @param offlineBeginTime   Indicates the start of the time range for which to retrieve offline payments,
     *                                      in RFC 3339 format for timestamps. The range is determined using the
     *                                      `offline_payment_details.client_created_at` field for each Payment. If set,
     *                                      payments without a value set in `offline_payment_details.client_created_at`
     *                                      will not be returned.  Default: The current time.
     * @param offlineEndTime     Indicates the end of the time range for which to retrieve offline payments,
     *                                      in RFC 3339 format for timestamps. The range is determined using the
     *                                      `offline_payment_details.client_created_at` field for each Payment. If set,
     *                                      payments without a value set in `offline_payment_details.client_created_at`
     *                                      will not be returned.  Default: The current time.
     * @return Response from the API call
     */
    async listPayments(beginTime, endTime, sortOrder, cursor, locationId, total, last4, cardBrand, limit, isOfflinePayment, offlineBeginTime, offlineEndTime, requestOptions) {
        const req = this.createRequest('GET', '/v2/payments');
        const mapped = req.prepareArgs({
            beginTime: [beginTime, optional(string())],
            endTime: [endTime, optional(string())],
            sortOrder: [sortOrder, optional(string())],
            cursor: [cursor, optional(string())],
            locationId: [locationId, optional(string())],
            total: [total, optional(bigint())],
            last4: [last4, optional(string())],
            cardBrand: [cardBrand, optional(string())],
            limit: [limit, optional(number())],
            isOfflinePayment: [isOfflinePayment, optional(boolean())],
            offlineBeginTime: [offlineBeginTime, optional(string())],
            offlineEndTime: [offlineEndTime, optional(string())],
        });
        req.query('begin_time', mapped.beginTime);
        req.query('end_time', mapped.endTime);
        req.query('sort_order', mapped.sortOrder);
        req.query('cursor', mapped.cursor);
        req.query('location_id', mapped.locationId);
        req.query('total', mapped.total);
        req.query('last_4', mapped.last4);
        req.query('card_brand', mapped.cardBrand);
        req.query('limit', mapped.limit);
        req.query('is_offline_payment', mapped.isOfflinePayment);
        req.query('offline_begin_time', mapped.offlineBeginTime);
        req.query('offline_end_time', mapped.offlineEndTime);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listPaymentsResponseSchema, requestOptions);
    }
    /**
     * Creates a payment using the provided source. You can use this endpoint
     * to charge a card (credit/debit card or
     * Square gift card) or record a payment that the seller received outside of Square
     * (cash payment from a buyer or a payment that an external entity
     * processed on behalf of the seller).
     *
     * The endpoint creates a
     * `Payment` object and returns it in the response.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                    the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createPayment(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/payments');
        const mapped = req.prepareArgs({
            body: [body, createPaymentRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createPaymentResponseSchema, requestOptions);
    }
    /**
     * Cancels (voids) a payment identified by the idempotency key that is specified in the
     * request.
     *
     * Use this method when the status of a `CreatePayment` request is unknown (for example, after you send
     * a
     * `CreatePayment` request, a network error occurs and you do not get a response). In this case, you
     * can
     * direct Square to cancel the payment using this endpoint. In the request, you provide the same
     * idempotency key that you provided in your `CreatePayment` request that you want to cancel. After
     * canceling the payment, you can submit your `CreatePayment` request again.
     *
     * Note that if no payment with the specified idempotency key is found, no action is taken and the
     * endpoint
     * returns successfully.
     *
     * @param body         An object containing the fields to POST for
     *                                                                    the request.  See the corresponding object
     *                                                                    definition for field details.
     * @return Response from the API call
     */
    async cancelPaymentByIdempotencyKey(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/payments/cancel');
        const mapped = req.prepareArgs({
            body: [body, cancelPaymentByIdempotencyKeyRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(cancelPaymentByIdempotencyKeyResponseSchema, requestOptions);
    }
    /**
     * Retrieves details for a specific payment.
     *
     * @param paymentId  A unique ID for the desired payment.
     * @return Response from the API call
     */
    async getPayment(paymentId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ paymentId: [paymentId, string()] });
        req.appendTemplatePath `/v2/payments/${mapped.paymentId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getPaymentResponseSchema, requestOptions);
    }
    /**
     * Updates a payment with the APPROVED status.
     * You can update the `amount_money` and `tip_money` using this endpoint.
     *
     * @param paymentId    The ID of the payment to update.
     * @param body         An object containing the fields to POST for the request.  See
     *                                                    the corresponding object definition for field details.
     * @return Response from the API call
     */
    async updatePayment(paymentId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            paymentId: [paymentId, string()],
            body: [body, updatePaymentRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/payments/${mapped.paymentId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updatePaymentResponseSchema, requestOptions);
    }
    /**
     * Cancels (voids) a payment. You can use this endpoint to cancel a payment with
     * the APPROVED `status`.
     *
     * @param paymentId  The ID of the payment to cancel.
     * @return Response from the API call
     */
    async cancelPayment(paymentId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({ paymentId: [paymentId, string()] });
        req.appendTemplatePath `/v2/payments/${mapped.paymentId}/cancel`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(cancelPaymentResponseSchema, requestOptions);
    }
    /**
     * Completes (captures) a payment.
     * By default, payments are set to complete immediately after they are created.
     *
     * You can use this endpoint to complete a payment with the APPROVED `status`.
     *
     * @param paymentId    The unique ID identifying the payment to be completed.
     * @param body         An object containing the fields to POST for the request.
     *                                                      See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async completePayment(paymentId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            paymentId: [paymentId, string()],
            body: [body, completePaymentRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/payments/${mapped.paymentId}/complete`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(completePaymentResponseSchema, requestOptions);
    }
}

const destinationSchema = object({
    type: ['type', optional(string())],
    id: ['id', optional(string())],
});

const payoutFeeSchema = object({
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    effectiveAt: ['effective_at', optional(nullable(string()))],
    type: ['type', optional(string())],
});

const payoutSchema = object({
    id: ['id', string()],
    status: ['status', optional(string())],
    locationId: ['location_id', string()],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    amountMoney: ['amount_money', optional(lazy(() => moneySchema))],
    destination: ['destination', optional(lazy(() => destinationSchema))],
    version: ['version', optional(number())],
    type: ['type', optional(string())],
    payoutFee: [
        'payout_fee',
        optional(nullable(array(lazy(() => payoutFeeSchema)))),
    ],
    arrivalDate: ['arrival_date', optional(nullable(string()))],
    endToEndId: ['end_to_end_id', optional(nullable(string()))],
});

const getPayoutResponseSchema = object({
    payout: ['payout', optional(lazy(() => payoutSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const paymentBalanceActivityAppFeeRefundDetailSchema = object({
    paymentId: ['payment_id', optional(nullable(string()))],
    refundId: ['refund_id', optional(nullable(string()))],
    locationId: ['location_id', optional(nullable(string()))],
});

const paymentBalanceActivityAppFeeRevenueDetailSchema = object({
    paymentId: ['payment_id', optional(nullable(string()))],
    locationId: ['location_id', optional(nullable(string()))],
});

const paymentBalanceActivityAutomaticSavingsDetailSchema = object({
    paymentId: ['payment_id', optional(nullable(string()))],
    payoutId: ['payout_id', optional(nullable(string()))],
});

const paymentBalanceActivityAutomaticSavingsReversedDetailSchema = object({
    paymentId: ['payment_id', optional(nullable(string()))],
    payoutId: ['payout_id', optional(nullable(string()))],
});

const paymentBalanceActivityChargeDetailSchema = object({ paymentId: ['payment_id', optional(nullable(string()))] });

const paymentBalanceActivityDepositFeeDetailSchema = object({ payoutId: ['payout_id', optional(nullable(string()))] });

const paymentBalanceActivityDisputeDetailSchema = object({
    paymentId: ['payment_id', optional(nullable(string()))],
    disputeId: ['dispute_id', optional(nullable(string()))],
});

const paymentBalanceActivityFeeDetailSchema = object({ paymentId: ['payment_id', optional(nullable(string()))] });

const paymentBalanceActivityFreeProcessingDetailSchema = object({ paymentId: ['payment_id', optional(nullable(string()))] });

const paymentBalanceActivityHoldAdjustmentDetailSchema = object({ paymentId: ['payment_id', optional(nullable(string()))] });

const paymentBalanceActivityOpenDisputeDetailSchema = object({
    paymentId: ['payment_id', optional(nullable(string()))],
    disputeId: ['dispute_id', optional(nullable(string()))],
});

const paymentBalanceActivityOtherAdjustmentDetailSchema = object({ paymentId: ['payment_id', optional(nullable(string()))] });

const paymentBalanceActivityOtherDetailSchema = object({ paymentId: ['payment_id', optional(nullable(string()))] });

const paymentBalanceActivityRefundDetailSchema = object({
    paymentId: ['payment_id', optional(nullable(string()))],
    refundId: ['refund_id', optional(nullable(string()))],
});

const paymentBalanceActivityReleaseAdjustmentDetailSchema = object({ paymentId: ['payment_id', optional(nullable(string()))] });

const paymentBalanceActivityReserveHoldDetailSchema = object({ paymentId: ['payment_id', optional(nullable(string()))] });

const paymentBalanceActivityReserveReleaseDetailSchema = object({ paymentId: ['payment_id', optional(nullable(string()))] });

const paymentBalanceActivitySquareCapitalPaymentDetailSchema = object({ paymentId: ['payment_id', optional(nullable(string()))] });

const paymentBalanceActivitySquareCapitalReversedPaymentDetailSchema = object({ paymentId: ['payment_id', optional(nullable(string()))] });

const paymentBalanceActivityTaxOnFeeDetailSchema = object({
    paymentId: ['payment_id', optional(nullable(string()))],
    taxRateDescription: ['tax_rate_description', optional(nullable(string()))],
});

const paymentBalanceActivityThirdPartyFeeDetailSchema = object({ paymentId: ['payment_id', optional(nullable(string()))] });

const paymentBalanceActivityThirdPartyFeeRefundDetailSchema = object({
    paymentId: ['payment_id', optional(nullable(string()))],
    refundId: ['refund_id', optional(nullable(string()))],
});

const payoutEntrySchema = object({
    id: ['id', string()],
    payoutId: ['payout_id', string()],
    effectiveAt: ['effective_at', optional(nullable(string()))],
    type: ['type', optional(string())],
    grossAmountMoney: ['gross_amount_money', optional(lazy(() => moneySchema))],
    feeAmountMoney: ['fee_amount_money', optional(lazy(() => moneySchema))],
    netAmountMoney: ['net_amount_money', optional(lazy(() => moneySchema))],
    typeAppFeeRevenueDetails: [
        'type_app_fee_revenue_details',
        optional(lazy(() => paymentBalanceActivityAppFeeRevenueDetailSchema)),
    ],
    typeAppFeeRefundDetails: [
        'type_app_fee_refund_details',
        optional(lazy(() => paymentBalanceActivityAppFeeRefundDetailSchema)),
    ],
    typeAutomaticSavingsDetails: [
        'type_automatic_savings_details',
        optional(lazy(() => paymentBalanceActivityAutomaticSavingsDetailSchema)),
    ],
    typeAutomaticSavingsReversedDetails: [
        'type_automatic_savings_reversed_details',
        optional(lazy(() => paymentBalanceActivityAutomaticSavingsReversedDetailSchema)),
    ],
    typeChargeDetails: [
        'type_charge_details',
        optional(lazy(() => paymentBalanceActivityChargeDetailSchema)),
    ],
    typeDepositFeeDetails: [
        'type_deposit_fee_details',
        optional(lazy(() => paymentBalanceActivityDepositFeeDetailSchema)),
    ],
    typeDisputeDetails: [
        'type_dispute_details',
        optional(lazy(() => paymentBalanceActivityDisputeDetailSchema)),
    ],
    typeFeeDetails: [
        'type_fee_details',
        optional(lazy(() => paymentBalanceActivityFeeDetailSchema)),
    ],
    typeFreeProcessingDetails: [
        'type_free_processing_details',
        optional(lazy(() => paymentBalanceActivityFreeProcessingDetailSchema)),
    ],
    typeHoldAdjustmentDetails: [
        'type_hold_adjustment_details',
        optional(lazy(() => paymentBalanceActivityHoldAdjustmentDetailSchema)),
    ],
    typeOpenDisputeDetails: [
        'type_open_dispute_details',
        optional(lazy(() => paymentBalanceActivityOpenDisputeDetailSchema)),
    ],
    typeOtherDetails: [
        'type_other_details',
        optional(lazy(() => paymentBalanceActivityOtherDetailSchema)),
    ],
    typeOtherAdjustmentDetails: [
        'type_other_adjustment_details',
        optional(lazy(() => paymentBalanceActivityOtherAdjustmentDetailSchema)),
    ],
    typeRefundDetails: [
        'type_refund_details',
        optional(lazy(() => paymentBalanceActivityRefundDetailSchema)),
    ],
    typeReleaseAdjustmentDetails: [
        'type_release_adjustment_details',
        optional(lazy(() => paymentBalanceActivityReleaseAdjustmentDetailSchema)),
    ],
    typeReserveHoldDetails: [
        'type_reserve_hold_details',
        optional(lazy(() => paymentBalanceActivityReserveHoldDetailSchema)),
    ],
    typeReserveReleaseDetails: [
        'type_reserve_release_details',
        optional(lazy(() => paymentBalanceActivityReserveReleaseDetailSchema)),
    ],
    typeSquareCapitalPaymentDetails: [
        'type_square_capital_payment_details',
        optional(lazy(() => paymentBalanceActivitySquareCapitalPaymentDetailSchema)),
    ],
    typeSquareCapitalReversedPaymentDetails: [
        'type_square_capital_reversed_payment_details',
        optional(lazy(() => paymentBalanceActivitySquareCapitalReversedPaymentDetailSchema)),
    ],
    typeTaxOnFeeDetails: [
        'type_tax_on_fee_details',
        optional(lazy(() => paymentBalanceActivityTaxOnFeeDetailSchema)),
    ],
    typeThirdPartyFeeDetails: [
        'type_third_party_fee_details',
        optional(lazy(() => paymentBalanceActivityThirdPartyFeeDetailSchema)),
    ],
    typeThirdPartyFeeRefundDetails: [
        'type_third_party_fee_refund_details',
        optional(lazy(() => paymentBalanceActivityThirdPartyFeeRefundDetailSchema)),
    ],
});

const listPayoutEntriesResponseSchema = object({
    payoutEntries: [
        'payout_entries',
        optional(array(lazy(() => payoutEntrySchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const listPayoutsResponseSchema = object({
    payouts: ['payouts', optional(array(lazy(() => payoutSchema)))],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class PayoutsApi extends BaseApi {
    /**
     * Retrieves a list of all payouts for the default location.
     * You can filter payouts by location ID, status, time range, and order them in ascending or descending
     * order.
     * To call this endpoint, set `PAYOUTS_READ` for the OAuth scope.
     *
     * @param locationId  The ID of the location for which to list the payouts. By default, payouts are
     *                              returned for the default (main) location associated with the seller.
     * @param status      If provided, only payouts with the given status are returned.
     * @param beginTime   The timestamp for the beginning of the payout creation time, in RFC 3339 format.
     *                              Inclusive. Default: The current time minus one year.
     * @param endTime     The timestamp for the end of the payout creation time, in RFC 3339 format. Default:
     *                              The current time.
     * @param sortOrder   The order in which payouts are listed.
     * @param cursor      A pagination cursor returned by a previous call to this endpoint. Provide this
     *                              cursor to retrieve the next set of results for the original query. For more
     *                              information, see [Pagination](https://developer.squareup.com/docs/build-basics/common-
     *                              api-patterns/pagination). If request parameters change between requests, subsequent
     *                              results may contain duplicates or missing records.
     * @param limit       The maximum number of results to be returned in a single page. It is possible to
     *                              receive fewer results than the specified limit on a given page. The default value of
     *                              100 is also the maximum allowed value. If the provided value is greater than 100, it
     *                              is ignored and the default value is used instead. Default: `100`
     * @return Response from the API call
     */
    async listPayouts(locationId, status, beginTime, endTime, sortOrder, cursor, limit, requestOptions) {
        const req = this.createRequest('GET', '/v2/payouts');
        const mapped = req.prepareArgs({
            locationId: [locationId, optional(string())],
            status: [status, optional(string())],
            beginTime: [beginTime, optional(string())],
            endTime: [endTime, optional(string())],
            sortOrder: [sortOrder, optional(string())],
            cursor: [cursor, optional(string())],
            limit: [limit, optional(number())],
        });
        req.query('location_id', mapped.locationId);
        req.query('status', mapped.status);
        req.query('begin_time', mapped.beginTime);
        req.query('end_time', mapped.endTime);
        req.query('sort_order', mapped.sortOrder);
        req.query('cursor', mapped.cursor);
        req.query('limit', mapped.limit);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listPayoutsResponseSchema, requestOptions);
    }
    /**
     * Retrieves details of a specific payout identified by a payout ID.
     * To call this endpoint, set `PAYOUTS_READ` for the OAuth scope.
     *
     * @param payoutId  The ID of the payout to retrieve the information for.
     * @return Response from the API call
     */
    async getPayout(payoutId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ payoutId: [payoutId, string()] });
        req.appendTemplatePath `/v2/payouts/${mapped.payoutId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getPayoutResponseSchema, requestOptions);
    }
    /**
     * Retrieves a list of all payout entries for a specific payout.
     * To call this endpoint, set `PAYOUTS_READ` for the OAuth scope.
     *
     * @param payoutId   The ID of the payout to retrieve the information for.
     * @param sortOrder  The order in which payout entries are listed.
     * @param cursor     A pagination cursor returned by a previous call to this endpoint. Provide this cursor
     *                             to retrieve the next set of results for the original query. For more information, see
     *                             [Pagination](https://developer.squareup.com/docs/build-basics/common-api-
     *                             patterns/pagination). If request parameters change between requests, subsequent
     *                             results may contain duplicates or missing records.
     * @param limit      The maximum number of results to be returned in a single page. It is possible to
     *                             receive fewer results than the specified limit on a given page. The default value of
     *                             100 is also the maximum allowed value. If the provided value is greater than 100, it
     *                             is ignored and the default value is used instead. Default: `100`
     * @return Response from the API call
     */
    async listPayoutEntries(payoutId, sortOrder, cursor, limit, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            payoutId: [payoutId, string()],
            sortOrder: [sortOrder, optional(string())],
            cursor: [cursor, optional(string())],
            limit: [limit, optional(number())],
        });
        req.query('sort_order', mapped.sortOrder);
        req.query('cursor', mapped.cursor);
        req.query('limit', mapped.limit);
        req.appendTemplatePath `/v2/payouts/${mapped.payoutId}/payout-entries`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(listPayoutEntriesResponseSchema, requestOptions);
    }
}

const destinationDetailsCardRefundDetailsSchema = object({
    card: ['card', optional(lazy(() => cardSchema))],
    entryMethod: ['entry_method', optional(nullable(string()))],
    authResultCode: ['auth_result_code', optional(nullable(string()))],
});

const destinationDetailsCashRefundDetailsSchema = object({
    sellerSuppliedMoney: ['seller_supplied_money', lazy(() => moneySchema)],
    changeBackMoney: ['change_back_money', optional(lazy(() => moneySchema))],
});

const destinationDetailsExternalRefundDetailsSchema = object({
    type: ['type', string()],
    source: ['source', string()],
    sourceId: ['source_id', optional(nullable(string()))],
});

const destinationDetailsSchema = object({
    cardDetails: [
        'card_details',
        optional(lazy(() => destinationDetailsCardRefundDetailsSchema)),
    ],
    cashDetails: [
        'cash_details',
        optional(lazy(() => destinationDetailsCashRefundDetailsSchema)),
    ],
    externalDetails: [
        'external_details',
        optional(lazy(() => destinationDetailsExternalRefundDetailsSchema)),
    ],
});

const paymentRefundSchema = object({
    id: ['id', string()],
    status: ['status', optional(nullable(string()))],
    locationId: ['location_id', optional(nullable(string()))],
    unlinked: ['unlinked', optional(boolean())],
    destinationType: ['destination_type', optional(nullable(string()))],
    destinationDetails: [
        'destination_details',
        optional(lazy(() => destinationDetailsSchema)),
    ],
    amountMoney: ['amount_money', lazy(() => moneySchema)],
    appFeeMoney: ['app_fee_money', optional(lazy(() => moneySchema))],
    processingFee: [
        'processing_fee',
        optional(nullable(array(lazy(() => processingFeeSchema)))),
    ],
    paymentId: ['payment_id', optional(nullable(string()))],
    orderId: ['order_id', optional(nullable(string()))],
    reason: ['reason', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    teamMemberId: ['team_member_id', optional(string())],
});

const getPaymentRefundResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    refund: ['refund', optional(lazy(() => paymentRefundSchema))],
});

const listPaymentRefundsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    refunds: ['refunds', optional(array(lazy(() => paymentRefundSchema)))],
    cursor: ['cursor', optional(string())],
});

const refundPaymentRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    amountMoney: ['amount_money', lazy(() => moneySchema)],
    appFeeMoney: ['app_fee_money', optional(lazy(() => moneySchema))],
    paymentId: ['payment_id', optional(nullable(string()))],
    destinationId: ['destination_id', optional(nullable(string()))],
    unlinked: ['unlinked', optional(nullable(boolean()))],
    locationId: ['location_id', optional(nullable(string()))],
    customerId: ['customer_id', optional(nullable(string()))],
    reason: ['reason', optional(nullable(string()))],
    paymentVersionToken: ['payment_version_token', optional(nullable(string()))],
    teamMemberId: ['team_member_id', optional(nullable(string()))],
    cashDetails: [
        'cash_details',
        optional(lazy(() => destinationDetailsCashRefundDetailsSchema)),
    ],
    externalDetails: [
        'external_details',
        optional(lazy(() => destinationDetailsExternalRefundDetailsSchema)),
    ],
});

const refundPaymentResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    refund: ['refund', optional(lazy(() => paymentRefundSchema))],
});

class RefundsApi extends BaseApi {
    /**
     * Retrieves a list of refunds for the account making the request.
     *
     * Results are eventually consistent, and new refunds or changes to refunds might take several
     * seconds to appear.
     *
     * The maximum results per page is 100.
     *
     * @param beginTime   Indicates the start of the time range to retrieve each `PaymentRefund` for, in RFC
     *                              3339  format.  The range is determined using the `created_at` field for each
     *                              `PaymentRefund`.   Default: The current time minus one year.
     * @param endTime     Indicates the end of the time range to retrieve each `PaymentRefund` for, in RFC
     *                              3339  format.  The range is determined using the `created_at` field for each
     *                              `PaymentRefund`.  Default: The current time.
     * @param sortOrder   The order in which results are listed by `PaymentRefund.created_at`: - `ASC` -
     *                              Oldest to newest. - `DESC` - Newest to oldest (default).
     * @param cursor      A pagination cursor returned by a previous call to this endpoint. Provide this
     *                              cursor to retrieve the next set of results for the original query.  For more
     *                              information, see [Pagination](https://developer.squareup.com/docs/build-basics/common-
     *                              api-patterns/pagination).
     * @param locationId  Limit results to the location supplied. By default, results are returned for all
     *                              locations associated with the seller.
     * @param status      If provided, only refunds with the given status are returned. For a list of refund
     *                              status values, see [PaymentRefund](entity:PaymentRefund).  Default: If omitted,
     *                              refunds are returned regardless of their status.
     * @param sourceType  If provided, only returns refunds whose payments have the indicated source type.
     *                              Current values include `CARD`, `BANK_ACCOUNT`, `WALLET`, `CASH`, and `EXTERNAL`. For
     *                              information about these payment source types, see [Take Payments](https://developer.
     *                              squareup.com/docs/payments-api/take-payments).  Default: If omitted, refunds are
     *                              returned regardless of the source type.
     * @param limit       The maximum number of results to be returned in a single page.  It is possible to
     *                              receive fewer results than the specified limit on a given page.  If the supplied
     *                              value is greater than 100, no more than 100 results are returned.  Default: 100
     * @return Response from the API call
     */
    async listPaymentRefunds(beginTime, endTime, sortOrder, cursor, locationId, status, sourceType, limit, requestOptions) {
        const req = this.createRequest('GET', '/v2/refunds');
        const mapped = req.prepareArgs({
            beginTime: [beginTime, optional(string())],
            endTime: [endTime, optional(string())],
            sortOrder: [sortOrder, optional(string())],
            cursor: [cursor, optional(string())],
            locationId: [locationId, optional(string())],
            status: [status, optional(string())],
            sourceType: [sourceType, optional(string())],
            limit: [limit, optional(number())],
        });
        req.query('begin_time', mapped.beginTime);
        req.query('end_time', mapped.endTime);
        req.query('sort_order', mapped.sortOrder);
        req.query('cursor', mapped.cursor);
        req.query('location_id', mapped.locationId);
        req.query('status', mapped.status);
        req.query('source_type', mapped.sourceType);
        req.query('limit', mapped.limit);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listPaymentRefundsResponseSchema, requestOptions);
    }
    /**
     * Refunds a payment. You can refund the entire payment amount or a
     * portion of it. You can use this endpoint to refund a card payment or record a
     * refund of a cash or external payment. For more information, see
     * [Refund Payment](https://developer.squareup.com/docs/payments-api/refund-payments).
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                    the corresponding object definition for field details.
     * @return Response from the API call
     */
    async refundPayment(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/refunds');
        const mapped = req.prepareArgs({
            body: [body, refundPaymentRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(refundPaymentResponseSchema, requestOptions);
    }
    /**
     * Retrieves a specific refund using the `refund_id`.
     *
     * @param refundId  The unique ID for the desired `PaymentRefund`.
     * @return Response from the API call
     */
    async getPaymentRefund(refundId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ refundId: [refundId, string()] });
        req.appendTemplatePath `/v2/refunds/${mapped.refundId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getPaymentRefundResponseSchema, requestOptions);
    }
}

const siteSchema = object({
    id: ['id', optional(string())],
    siteTitle: ['site_title', optional(nullable(string()))],
    domain: ['domain', optional(nullable(string()))],
    isPublished: ['is_published', optional(nullable(boolean()))],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
});

const listSitesResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    sites: ['sites', optional(array(lazy(() => siteSchema)))],
});

class SitesApi extends BaseApi {
    /**
     * Lists the Square Online sites that belong to a seller. Sites are listed in descending order by the
     * `created_at` date.
     *
     *
     * __Note:__ Square Online APIs are publicly available as part of an early access program. For more
     * information, see [Early access program for Square Online APIs](https://developer.squareup.
     * com/docs/online-api#early-access-program-for-square-online-apis).
     *
     * @return Response from the API call
     */
    async listSites(requestOptions) {
        const req = this.createRequest('GET', '/v2/sites');
        req.authenticate([{ global: true }]);
        return req.callAsJson(listSitesResponseSchema, requestOptions);
    }
}

const deleteSnippetResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const snippetSchema = object({
    id: ['id', optional(string())],
    siteId: ['site_id', optional(string())],
    content: ['content', string()],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
});

const retrieveSnippetResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    snippet: ['snippet', optional(lazy(() => snippetSchema))],
});

const upsertSnippetRequestSchema = object({
    snippet: ['snippet', lazy(() => snippetSchema)],
});

const upsertSnippetResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    snippet: ['snippet', optional(lazy(() => snippetSchema))],
});

class SnippetsApi extends BaseApi {
    /**
     * Removes your snippet from a Square Online site.
     *
     * You can call [ListSites]($e/Sites/ListSites) to get the IDs of the sites that belong to a seller.
     *
     *
     * __Note:__ Square Online APIs are publicly available as part of an early access program. For more
     * information, see [Early access program for Square Online APIs](https://developer.squareup.
     * com/docs/online-api#early-access-program-for-square-online-apis).
     *
     * @param siteId  The ID of the site that contains the snippet.
     * @return Response from the API call
     */
    async deleteSnippet(siteId, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({ siteId: [siteId, string()] });
        req.appendTemplatePath `/v2/sites/${mapped.siteId}/snippet`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteSnippetResponseSchema, requestOptions);
    }
    /**
     * Retrieves your snippet from a Square Online site. A site can contain snippets from multiple snippet
     * applications, but you can retrieve only the snippet that was added by your application.
     *
     * You can call [ListSites]($e/Sites/ListSites) to get the IDs of the sites that belong to a seller.
     *
     *
     * __Note:__ Square Online APIs are publicly available as part of an early access program. For more
     * information, see [Early access program for Square Online APIs](https://developer.squareup.
     * com/docs/online-api#early-access-program-for-square-online-apis).
     *
     * @param siteId  The ID of the site that contains the snippet.
     * @return Response from the API call
     */
    async retrieveSnippet(siteId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ siteId: [siteId, string()] });
        req.appendTemplatePath `/v2/sites/${mapped.siteId}/snippet`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveSnippetResponseSchema, requestOptions);
    }
    /**
     * Adds a snippet to a Square Online site or updates the existing snippet on the site.
     * The snippet code is appended to the end of the `head` element on every page of the site, except
     * checkout pages. A snippet application can add one snippet to a given site.
     *
     * You can call [ListSites]($e/Sites/ListSites) to get the IDs of the sites that belong to a seller.
     *
     *
     * __Note:__ Square Online APIs are publicly available as part of an early access program. For more
     * information, see [Early access program for Square Online APIs](https://developer.squareup.
     * com/docs/online-api#early-access-program-for-square-online-apis).
     *
     * @param siteId       The ID of the site where you want to add or update the snippet.
     * @param body         An object containing the fields to POST for the request.  See
     *                                                    the corresponding object definition for field details.
     * @return Response from the API call
     */
    async upsertSnippet(siteId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            siteId: [siteId, string()],
            body: [body, upsertSnippetRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/sites/${mapped.siteId}/snippet`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(upsertSnippetResponseSchema, requestOptions);
    }
}

const bulkSwapPlanRequestSchema = object({
    newPlanVariationId: ['new_plan_variation_id', string()],
    oldPlanVariationId: ['old_plan_variation_id', string()],
    locationId: ['location_id', string()],
});

const bulkSwapPlanResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    affectedSubscriptions: ['affected_subscriptions', optional(number())],
});

const phaseSchema = object({
    uid: ['uid', optional(nullable(string()))],
    ordinal: ['ordinal', optional(nullable(bigint()))],
    orderTemplateId: ['order_template_id', optional(nullable(string()))],
    planPhaseUid: ['plan_phase_uid', optional(nullable(string()))],
});

const subscriptionActionSchema = object({
    id: ['id', optional(string())],
    type: ['type', optional(string())],
    effectiveDate: ['effective_date', optional(nullable(string()))],
    monthlyBillingAnchorDate: [
        'monthly_billing_anchor_date',
        optional(nullable(number())),
    ],
    phases: ['phases', optional(nullable(array(lazy(() => phaseSchema))))],
    newPlanVariationId: ['new_plan_variation_id', optional(nullable(string()))],
});

const subscriptionSourceSchema = object({
    name: ['name', optional(nullable(string()))],
});

const subscriptionSchema = object({
    id: ['id', optional(string())],
    locationId: ['location_id', optional(string())],
    planVariationId: ['plan_variation_id', optional(string())],
    customerId: ['customer_id', optional(string())],
    startDate: ['start_date', optional(string())],
    canceledDate: ['canceled_date', optional(nullable(string()))],
    chargedThroughDate: ['charged_through_date', optional(string())],
    status: ['status', optional(string())],
    taxPercentage: ['tax_percentage', optional(nullable(string()))],
    invoiceIds: ['invoice_ids', optional(array(string()))],
    priceOverrideMoney: [
        'price_override_money',
        optional(lazy(() => moneySchema)),
    ],
    version: ['version', optional(bigint())],
    createdAt: ['created_at', optional(string())],
    cardId: ['card_id', optional(nullable(string()))],
    timezone: ['timezone', optional(string())],
    source: ['source', optional(lazy(() => subscriptionSourceSchema))],
    actions: [
        'actions',
        optional(nullable(array(lazy(() => subscriptionActionSchema)))),
    ],
    monthlyBillingAnchorDate: ['monthly_billing_anchor_date', optional(number())],
    phases: ['phases', optional(array(lazy(() => phaseSchema)))],
});

const cancelSubscriptionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscription: ['subscription', optional(lazy(() => subscriptionSchema))],
    actions: ['actions', optional(array(lazy(() => subscriptionActionSchema)))],
});

const changeBillingAnchorDateRequestSchema = object({
    monthlyBillingAnchorDate: [
        'monthly_billing_anchor_date',
        optional(nullable(number())),
    ],
    effectiveDate: ['effective_date', optional(nullable(string()))],
});

const changeBillingAnchorDateResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscription: ['subscription', optional(lazy(() => subscriptionSchema))],
    actions: ['actions', optional(array(lazy(() => subscriptionActionSchema)))],
});

const createSubscriptionRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(string())],
    locationId: ['location_id', string()],
    planVariationId: ['plan_variation_id', optional(string())],
    customerId: ['customer_id', string()],
    startDate: ['start_date', optional(string())],
    canceledDate: ['canceled_date', optional(string())],
    taxPercentage: ['tax_percentage', optional(string())],
    priceOverrideMoney: [
        'price_override_money',
        optional(lazy(() => moneySchema)),
    ],
    cardId: ['card_id', optional(string())],
    timezone: ['timezone', optional(string())],
    source: ['source', optional(lazy(() => subscriptionSourceSchema))],
    monthlyBillingAnchorDate: [
        'monthly_billing_anchor_date',
        optional(number()),
    ],
    phases: ['phases', optional(array(lazy(() => phaseSchema)))],
});

const createSubscriptionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscription: ['subscription', optional(lazy(() => subscriptionSchema))],
});

const deleteSubscriptionActionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscription: ['subscription', optional(lazy(() => subscriptionSchema))],
});

const subscriptionEventInfoSchema = object({
    detail: ['detail', optional(nullable(string()))],
    code: ['code', optional(string())],
});

const subscriptionEventSchema = object({
    id: ['id', string()],
    subscriptionEventType: ['subscription_event_type', string()],
    effectiveDate: ['effective_date', string()],
    monthlyBillingAnchorDate: ['monthly_billing_anchor_date', optional(number())],
    info: ['info', optional(lazy(() => subscriptionEventInfoSchema))],
    phases: ['phases', optional(nullable(array(lazy(() => phaseSchema))))],
    planVariationId: ['plan_variation_id', string()],
});

const listSubscriptionEventsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscriptionEvents: [
        'subscription_events',
        optional(array(lazy(() => subscriptionEventSchema))),
    ],
    cursor: ['cursor', optional(string())],
});

const pauseSubscriptionRequestSchema = object({
    pauseEffectiveDate: ['pause_effective_date', optional(nullable(string()))],
    pauseCycleDuration: ['pause_cycle_duration', optional(nullable(bigint()))],
    resumeEffectiveDate: [
        'resume_effective_date',
        optional(nullable(string())),
    ],
    resumeChangeTiming: ['resume_change_timing', optional(string())],
    pauseReason: ['pause_reason', optional(nullable(string()))],
});

const pauseSubscriptionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscription: ['subscription', optional(lazy(() => subscriptionSchema))],
    actions: ['actions', optional(array(lazy(() => subscriptionActionSchema)))],
});

const resumeSubscriptionRequestSchema = object({
    resumeEffectiveDate: [
        'resume_effective_date',
        optional(nullable(string())),
    ],
    resumeChangeTiming: ['resume_change_timing', optional(string())],
});

const resumeSubscriptionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscription: ['subscription', optional(lazy(() => subscriptionSchema))],
    actions: ['actions', optional(array(lazy(() => subscriptionActionSchema)))],
});

const retrieveSubscriptionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscription: ['subscription', optional(lazy(() => subscriptionSchema))],
});

const searchSubscriptionsFilterSchema = object({
    customerIds: ['customer_ids', optional(nullable(array(string())))],
    locationIds: ['location_ids', optional(nullable(array(string())))],
    sourceNames: ['source_names', optional(nullable(array(string())))],
});

const searchSubscriptionsQuerySchema = object({ filter: ['filter', optional(lazy(() => searchSubscriptionsFilterSchema))] });

const searchSubscriptionsRequestSchema = object({
    cursor: ['cursor', optional(string())],
    limit: ['limit', optional(number())],
    query: ['query', optional(lazy(() => searchSubscriptionsQuerySchema))],
    include: ['include', optional(array(string()))],
});

const searchSubscriptionsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscriptions: [
        'subscriptions',
        optional(array(lazy(() => subscriptionSchema))),
    ],
    cursor: ['cursor', optional(string())],
});

const phaseInputSchema = object({
    ordinal: ['ordinal', bigint()],
    orderTemplateId: ['order_template_id', optional(nullable(string()))],
});

const swapPlanRequestSchema = object({
    newPlanVariationId: ['new_plan_variation_id', optional(nullable(string()))],
    phases: ['phases', optional(nullable(array(lazy(() => phaseInputSchema))))],
});

const swapPlanResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscription: ['subscription', optional(lazy(() => subscriptionSchema))],
    actions: ['actions', optional(array(lazy(() => subscriptionActionSchema)))],
});

const updateSubscriptionRequestSchema = object({ subscription: ['subscription', optional(lazy(() => subscriptionSchema))] });

const updateSubscriptionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscription: ['subscription', optional(lazy(() => subscriptionSchema))],
});

class SubscriptionsApi extends BaseApi {
    /**
     * Enrolls a customer in a subscription.
     *
     * If you provide a card on file in the request, Square charges the card for
     * the subscription. Otherwise, Square sends an invoice to the customer's email
     * address. The subscription starts immediately, unless the request includes
     * the optional `start_date`. Each individual subscription is associated with a particular location.
     *
     * For more information, see [Create a subscription](https://developer.squareup.com/docs/subscriptions-
     * api/manage-subscriptions#create-a-subscription).
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                         See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createSubscription(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/subscriptions');
        const mapped = req.prepareArgs({
            body: [body, createSubscriptionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createSubscriptionResponseSchema, requestOptions);
    }
    /**
     * Schedules a plan variation change for all active subscriptions under a given plan
     * variation. For more information, see [Swap Subscription Plan Variations](https://developer.squareup.
     * com/docs/subscriptions-api/swap-plan-variations).
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                   the corresponding object definition for field details.
     * @return Response from the API call
     */
    async bulkSwapPlan(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/subscriptions/bulk-swap-plan');
        const mapped = req.prepareArgs({ body: [body, bulkSwapPlanRequestSchema] });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkSwapPlanResponseSchema, requestOptions);
    }
    /**
     * Searches for subscriptions.
     *
     * Results are ordered chronologically by subscription creation date. If
     * the request specifies more than one location ID,
     * the endpoint orders the result
     * by location ID, and then by creation date within each location. If no locations are given
     * in the query, all locations are searched.
     *
     * You can also optionally specify `customer_ids` to search by customer.
     * If left unset, all customers
     * associated with the specified locations are returned.
     * If the request specifies customer IDs, the endpoint orders results
     * first by location, within location by customer ID, and within
     * customer by subscription creation date.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async searchSubscriptions(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/subscriptions/search');
        const mapped = req.prepareArgs({
            body: [body, searchSubscriptionsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchSubscriptionsResponseSchema, requestOptions);
    }
    /**
     * Retrieves a specific subscription.
     *
     * @param subscriptionId  The ID of the subscription to retrieve.
     * @param include         A query parameter to specify related information to be included in the response.
     *                                  The supported query parameter values are:   - `actions`: to include scheduled
     *                                  actions on the targeted subscription.
     * @return Response from the API call
     */
    async retrieveSubscription(subscriptionId, include, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
            include: [include, optional(string())],
        });
        req.query('include', mapped.include);
        req.appendTemplatePath `/v2/subscriptions/${mapped.subscriptionId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveSubscriptionResponseSchema, requestOptions);
    }
    /**
     * Updates a subscription by modifying or clearing `subscription` field values.
     * To clear a field, set its value to `null`.
     *
     * @param subscriptionId  The ID of the subscription to update.
     * @param body            An object containing the fields to POST for the
     *                                                            request.  See the corresponding object definition for
     *                                                            field details.
     * @return Response from the API call
     */
    async updateSubscription(subscriptionId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
            body: [body, updateSubscriptionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/subscriptions/${mapped.subscriptionId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateSubscriptionResponseSchema, requestOptions);
    }
    /**
     * Deletes a scheduled action for a subscription.
     *
     * @param subscriptionId  The ID of the subscription the targeted action is to act upon.
     * @param actionId        The ID of the targeted action to be deleted.
     * @return Response from the API call
     */
    async deleteSubscriptionAction(subscriptionId, actionId, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
            actionId: [actionId, string()],
        });
        req.appendTemplatePath `/v2/subscriptions/${mapped.subscriptionId}/actions/${mapped.actionId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteSubscriptionActionResponseSchema, requestOptions);
    }
    /**
     * Changes the [billing anchor date](https://developer.squareup.com/docs/subscriptions-api/subscription-
     * billing#billing-dates)
     * for a subscription.
     *
     * @param subscriptionId  The ID of the subscription to update the billing
     *                                                                 anchor date.
     * @param body            An object containing the fields to POST for the
     *                                                                 request.  See the corresponding object definition
     *                                                                 for field details.
     * @return Response from the API call
     */
    async changeBillingAnchorDate(subscriptionId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
            body: [body, changeBillingAnchorDateRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/subscriptions/${mapped.subscriptionId}/billing-anchor`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(changeBillingAnchorDateResponseSchema, requestOptions);
    }
    /**
     * Schedules a `CANCEL` action to cancel an active subscription. This
     * sets the `canceled_date` field to the end of the active billing period. After this date,
     * the subscription status changes from ACTIVE to CANCELED.
     *
     * @param subscriptionId  The ID of the subscription to cancel.
     * @return Response from the API call
     */
    async cancelSubscription(subscriptionId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
        });
        req.appendTemplatePath `/v2/subscriptions/${mapped.subscriptionId}/cancel`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(cancelSubscriptionResponseSchema, requestOptions);
    }
    /**
     * Lists all [events](https://developer.squareup.com/docs/subscriptions-api/actions-events) for a
     * specific subscription.
     *
     * @param subscriptionId  The ID of the subscription to retrieve the events for.
     * @param cursor          When the total number of resulting subscription events exceeds the limit of a
     *                                  paged response,  specify the cursor returned from a preceding response here to
     *                                  fetch the next set of results. If the cursor is unset, the response contains the
     *                                  last page of the results.  For more information, see [Pagination](https:
     *                                  //developer.squareup.com/docs/build-basics/common-api-patterns/pagination).
     * @param limit           The upper limit on the number of subscription events to return in a paged
     *                                  response.
     * @return Response from the API call
     */
    async listSubscriptionEvents(subscriptionId, cursor, limit, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
            cursor: [cursor, optional(string())],
            limit: [limit, optional(number())],
        });
        req.query('cursor', mapped.cursor);
        req.query('limit', mapped.limit);
        req.appendTemplatePath `/v2/subscriptions/${mapped.subscriptionId}/events`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(listSubscriptionEventsResponseSchema, requestOptions);
    }
    /**
     * Schedules a `PAUSE` action to pause an active subscription.
     *
     * @param subscriptionId  The ID of the subscription to pause.
     * @param body            An object containing the fields to POST for the request.
     *                                                           See the corresponding object definition for field
     *                                                           details.
     * @return Response from the API call
     */
    async pauseSubscription(subscriptionId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
            body: [body, pauseSubscriptionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/subscriptions/${mapped.subscriptionId}/pause`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(pauseSubscriptionResponseSchema, requestOptions);
    }
    /**
     * Schedules a `RESUME` action to resume a paused or a deactivated subscription.
     *
     * @param subscriptionId  The ID of the subscription to resume.
     * @param body            An object containing the fields to POST for the
     *                                                            request.  See the corresponding object definition for
     *                                                            field details.
     * @return Response from the API call
     */
    async resumeSubscription(subscriptionId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
            body: [body, resumeSubscriptionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/subscriptions/${mapped.subscriptionId}/resume`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(resumeSubscriptionResponseSchema, requestOptions);
    }
    /**
     * Schedules a `SWAP_PLAN` action to swap a subscription plan variation in an existing subscription.
     * For more information, see [Swap Subscription Plan Variations](https://developer.squareup.
     * com/docs/subscriptions-api/swap-plan-variations).
     *
     * @param subscriptionId  The ID of the subscription to swap the subscription plan for.
     * @param body            An object containing the fields to POST for the request.  See
     *                                                  the corresponding object definition for field details.
     * @return Response from the API call
     */
    async swapPlan(subscriptionId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
            body: [body, swapPlanRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/subscriptions/${mapped.subscriptionId}/swap-plan`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(swapPlanResponseSchema, requestOptions);
    }
}

const teamMemberAssignedLocationsSchema = object({
    assignmentType: ['assignment_type', optional(string())],
    locationIds: ['location_ids', optional(nullable(array(string())))],
});

const teamMemberSchema = object({
    id: ['id', optional(string())],
    referenceId: ['reference_id', optional(nullable(string()))],
    isOwner: ['is_owner', optional(boolean())],
    status: ['status', optional(string())],
    givenName: ['given_name', optional(nullable(string()))],
    familyName: ['family_name', optional(nullable(string()))],
    emailAddress: ['email_address', optional(nullable(string()))],
    phoneNumber: ['phone_number', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    assignedLocations: [
        'assigned_locations',
        optional(lazy(() => teamMemberAssignedLocationsSchema)),
    ],
});

const createTeamMemberRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(string())],
    teamMember: ['team_member', optional(lazy(() => teamMemberSchema))],
});

const bulkCreateTeamMembersRequestSchema = object({
    teamMembers: [
        'team_members',
        dict(lazy(() => createTeamMemberRequestSchema)),
    ],
});

const createTeamMemberResponseSchema = object({
    teamMember: ['team_member', optional(lazy(() => teamMemberSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkCreateTeamMembersResponseSchema = object({
    teamMembers: [
        'team_members',
        optional(dict(lazy(() => createTeamMemberResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateTeamMemberRequestSchema = object({ teamMember: ['team_member', optional(lazy(() => teamMemberSchema))] });

const bulkUpdateTeamMembersRequestSchema = object({
    teamMembers: [
        'team_members',
        dict(lazy(() => updateTeamMemberRequestSchema)),
    ],
});

const updateTeamMemberResponseSchema = object({
    teamMember: ['team_member', optional(lazy(() => teamMemberSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const bulkUpdateTeamMembersResponseSchema = object({
    teamMembers: [
        'team_members',
        optional(dict(lazy(() => updateTeamMemberResponseSchema))),
    ],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const retrieveTeamMemberResponseSchema = object({
    teamMember: ['team_member', optional(lazy(() => teamMemberSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const jobAssignmentSchema = object({
    jobTitle: ['job_title', string()],
    payType: ['pay_type', string()],
    hourlyRate: ['hourly_rate', optional(lazy(() => moneySchema))],
    annualRate: ['annual_rate', optional(lazy(() => moneySchema))],
    weeklyHours: ['weekly_hours', optional(nullable(number()))],
});

const wageSettingSchema = object({
    teamMemberId: ['team_member_id', optional(nullable(string()))],
    jobAssignments: [
        'job_assignments',
        optional(nullable(array(lazy(() => jobAssignmentSchema)))),
    ],
    isOvertimeExempt: ['is_overtime_exempt', optional(nullable(boolean()))],
    version: ['version', optional(number())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
});

const retrieveWageSettingResponseSchema = object({
    wageSetting: ['wage_setting', optional(lazy(() => wageSettingSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const searchTeamMembersFilterSchema = object({
    locationIds: ['location_ids', optional(nullable(array(string())))],
    status: ['status', optional(string())],
    isOwner: ['is_owner', optional(nullable(boolean()))],
});

const searchTeamMembersQuerySchema = object({ filter: ['filter', optional(lazy(() => searchTeamMembersFilterSchema))] });

const searchTeamMembersRequestSchema = object({
    query: ['query', optional(lazy(() => searchTeamMembersQuerySchema))],
    limit: ['limit', optional(number())],
    cursor: ['cursor', optional(string())],
});

const searchTeamMembersResponseSchema = object({
    teamMembers: [
        'team_members',
        optional(array(lazy(() => teamMemberSchema))),
    ],
    cursor: ['cursor', optional(string())],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

const updateWageSettingRequestSchema = object({ wageSetting: ['wage_setting', lazy(() => wageSettingSchema)] });

const updateWageSettingResponseSchema = object({
    wageSetting: ['wage_setting', optional(lazy(() => wageSettingSchema))],
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
});

class TeamApi extends BaseApi {
    /**
     * Creates a single `TeamMember` object. The `TeamMember` object is returned on successful creates.
     * You must provide the following values in your request to this endpoint:
     * - `given_name`
     * - `family_name`
     *
     * Learn about [Troubleshooting the Team API](https://developer.squareup.
     * com/docs/team/troubleshooting#createteammember).
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                       See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createTeamMember(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/team-members');
        const mapped = req.prepareArgs({
            body: [body, createTeamMemberRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createTeamMemberResponseSchema, requestOptions);
    }
    /**
     * Creates multiple `TeamMember` objects. The created `TeamMember` objects are returned on successful
     * creates.
     * This process is non-transactional and processes as much of the request as possible. If one of the
     * creates in
     * the request cannot be successfully processed, the request is not marked as failed, but the body of
     * the response
     * contains explicit error information for the failed create.
     *
     * Learn about [Troubleshooting the Team API](https://developer.squareup.
     * com/docs/team/troubleshooting#bulk-create-team-members).
     *
     * @param body         An object containing the fields to POST for the
     *                                                            request.  See the corresponding object definition for
     *                                                            field details.
     * @return Response from the API call
     */
    async bulkCreateTeamMembers(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/team-members/bulk-create');
        const mapped = req.prepareArgs({
            body: [body, bulkCreateTeamMembersRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkCreateTeamMembersResponseSchema, requestOptions);
    }
    /**
     * Updates multiple `TeamMember` objects. The updated `TeamMember` objects are returned on successful
     * updates.
     * This process is non-transactional and processes as much of the request as possible. If one of the
     * updates in
     * the request cannot be successfully processed, the request is not marked as failed, but the body of
     * the response
     * contains explicit error information for the failed update.
     * Learn about [Troubleshooting the Team API](https://developer.squareup.
     * com/docs/team/troubleshooting#bulk-update-team-members).
     *
     * @param body         An object containing the fields to POST for the
     *                                                            request.  See the corresponding object definition for
     *                                                            field details.
     * @return Response from the API call
     */
    async bulkUpdateTeamMembers(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/team-members/bulk-update');
        const mapped = req.prepareArgs({
            body: [body, bulkUpdateTeamMembersRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkUpdateTeamMembersResponseSchema, requestOptions);
    }
    /**
     * Returns a paginated list of `TeamMember` objects for a business.
     * The list can be filtered by the following:
     * - location IDs
     * - `status`
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                        See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async searchTeamMembers(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/team-members/search');
        const mapped = req.prepareArgs({
            body: [body, searchTeamMembersRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchTeamMembersResponseSchema, requestOptions);
    }
    /**
     * Retrieves a `TeamMember` object for the given `TeamMember.id`.
     * Learn about [Troubleshooting the Team API](https://developer.squareup.
     * com/docs/team/troubleshooting#retrieve-a-team-member).
     *
     * @param teamMemberId   The ID of the team member to retrieve.
     * @return Response from the API call
     */
    async retrieveTeamMember(teamMemberId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ teamMemberId: [teamMemberId, string()] });
        req.appendTemplatePath `/v2/team-members/${mapped.teamMemberId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveTeamMemberResponseSchema, requestOptions);
    }
    /**
     * Updates a single `TeamMember` object. The `TeamMember` object is returned on successful updates.
     * Learn about [Troubleshooting the Team API](https://developer.squareup.
     * com/docs/team/troubleshooting#update-a-team-member).
     *
     * @param teamMemberId   The ID of the team member to update.
     * @param body           An object containing the fields to POST for the request.
     *                                                         See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async updateTeamMember(teamMemberId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            teamMemberId: [teamMemberId, string()],
            body: [body, updateTeamMemberRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/team-members/${mapped.teamMemberId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateTeamMemberResponseSchema, requestOptions);
    }
    /**
     * Retrieves a `WageSetting` object for a team member specified
     * by `TeamMember.id`.
     * Learn about [Troubleshooting the Team API](https://developer.squareup.
     * com/docs/team/troubleshooting#retrievewagesetting).
     *
     * @param teamMemberId   The ID of the team member for which to retrieve the wage setting.
     * @return Response from the API call
     */
    async retrieveWageSetting(teamMemberId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ teamMemberId: [teamMemberId, string()] });
        req.appendTemplatePath `/v2/team-members/${mapped.teamMemberId}/wage-setting`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveWageSettingResponseSchema, requestOptions);
    }
    /**
     * Creates or updates a `WageSetting` object. The object is created if a
     * `WageSetting` with the specified `team_member_id` does not exist. Otherwise,
     * it fully replaces the `WageSetting` object for the team member.
     * The `WageSetting` is returned on a successful update.
     * Learn about [Troubleshooting the Team API](https://developer.squareup.
     * com/docs/team/troubleshooting#create-or-update-a-wage-setting).
     *
     * @param teamMemberId   The ID of the team member for which to update the
     *                                                          `WageSetting` object.
     * @param body           An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async updateWageSetting(teamMemberId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            teamMemberId: [teamMemberId, string()],
            body: [body, updateWageSettingRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/team-members/${mapped.teamMemberId}/wage-setting`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateWageSettingResponseSchema, requestOptions);
    }
}

const confirmationDecisionSchema = object({
    hasAgreed: ['has_agreed', optional(boolean())],
});

const confirmationOptionsSchema = object({
    title: ['title', string()],
    body: ['body', string()],
    agreeButtonText: ['agree_button_text', string()],
    disagreeButtonText: ['disagree_button_text', optional(nullable(string()))],
    decision: ['decision', optional(lazy(() => confirmationDecisionSchema))],
});

const collectedDataSchema = object({
    inputText: ['input_text', optional(string())],
});

const dataCollectionOptionsSchema = object({
    title: ['title', string()],
    body: ['body', string()],
    inputType: ['input_type', string()],
    collectedData: [
        'collected_data',
        optional(lazy(() => collectedDataSchema)),
    ],
});

const deviceMetadataSchema = object({
    batteryPercentage: ['battery_percentage', optional(nullable(string()))],
    chargingState: ['charging_state', optional(nullable(string()))],
    locationId: ['location_id', optional(nullable(string()))],
    merchantId: ['merchant_id', optional(nullable(string()))],
    networkConnectionType: [
        'network_connection_type',
        optional(nullable(string())),
    ],
    paymentRegion: ['payment_region', optional(nullable(string()))],
    serialNumber: ['serial_number', optional(nullable(string()))],
    osVersion: ['os_version', optional(nullable(string()))],
    appVersion: ['app_version', optional(nullable(string()))],
    wifiNetworkName: ['wifi_network_name', optional(nullable(string()))],
    wifiNetworkStrength: ['wifi_network_strength', optional(nullable(string()))],
    ipAddress: ['ip_address', optional(nullable(string()))],
});

const qrCodeOptionsSchema = object({
    title: ['title', string()],
    body: ['body', string()],
    barcodeContents: ['barcode_contents', string()],
});

const receiptOptionsSchema = object({
    paymentId: ['payment_id', string()],
    printOnly: ['print_only', optional(nullable(boolean()))],
    isDuplicate: ['is_duplicate', optional(nullable(boolean()))],
});

const saveCardOptionsSchema = object({
    customerId: ['customer_id', string()],
    cardId: ['card_id', optional(string())],
    referenceId: ['reference_id', optional(nullable(string()))],
});

const selectOptionSchema = object({
    referenceId: ['reference_id', string()],
    title: ['title', string()],
});

const selectOptionsSchema = object({
    title: ['title', string()],
    body: ['body', string()],
    options: ['options', array(lazy(() => selectOptionSchema))],
    selectedOption: ['selected_option', optional(lazy(() => selectOptionSchema))],
});

const signatureImageSchema = object({
    imageType: ['image_type', optional(string())],
    data: ['data', optional(string())],
});

const signatureOptionsSchema = object({
    title: ['title', string()],
    body: ['body', string()],
    signature: ['signature', optional(array(lazy(() => signatureImageSchema)))],
});

const terminalActionSchema = object({
    id: ['id', optional(string())],
    deviceId: ['device_id', optional(nullable(string()))],
    deadlineDuration: ['deadline_duration', optional(nullable(string()))],
    status: ['status', optional(string())],
    cancelReason: ['cancel_reason', optional(string())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    appId: ['app_id', optional(string())],
    locationId: ['location_id', optional(string())],
    type: ['type', optional(string())],
    qrCodeOptions: ['qr_code_options', optional(lazy(() => qrCodeOptionsSchema))],
    saveCardOptions: [
        'save_card_options',
        optional(lazy(() => saveCardOptionsSchema)),
    ],
    signatureOptions: [
        'signature_options',
        optional(lazy(() => signatureOptionsSchema)),
    ],
    confirmationOptions: [
        'confirmation_options',
        optional(lazy(() => confirmationOptionsSchema)),
    ],
    receiptOptions: [
        'receipt_options',
        optional(lazy(() => receiptOptionsSchema)),
    ],
    dataCollectionOptions: [
        'data_collection_options',
        optional(lazy(() => dataCollectionOptionsSchema)),
    ],
    selectOptions: ['select_options', optional(lazy(() => selectOptionsSchema))],
    deviceMetadata: [
        'device_metadata',
        optional(lazy(() => deviceMetadataSchema)),
    ],
    awaitNextAction: ['await_next_action', optional(nullable(boolean()))],
    awaitNextActionDuration: [
        'await_next_action_duration',
        optional(nullable(string())),
    ],
});

const cancelTerminalActionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    action: ['action', optional(lazy(() => terminalActionSchema))],
});

const tipSettingsSchema = object({
    allowTipping: ['allow_tipping', optional(nullable(boolean()))],
    separateTipScreen: ['separate_tip_screen', optional(nullable(boolean()))],
    customTipField: ['custom_tip_field', optional(nullable(boolean()))],
    tipPercentages: ['tip_percentages', optional(nullable(array(number())))],
    smartTipping: ['smart_tipping', optional(nullable(boolean()))],
});

const deviceCheckoutOptionsSchema = object({
    deviceId: ['device_id', string()],
    skipReceiptScreen: ['skip_receipt_screen', optional(nullable(boolean()))],
    collectSignature: ['collect_signature', optional(nullable(boolean()))],
    tipSettings: ['tip_settings', optional(lazy(() => tipSettingsSchema))],
    showItemizedCart: ['show_itemized_cart', optional(nullable(boolean()))],
});

const paymentOptionsSchema = object({
    autocomplete: ['autocomplete', optional(nullable(boolean()))],
    delayDuration: ['delay_duration', optional(nullable(string()))],
    acceptPartialAuthorization: [
        'accept_partial_authorization',
        optional(nullable(boolean())),
    ],
    delayAction: ['delay_action', optional(string())],
});

const terminalCheckoutSchema = object({
    id: ['id', optional(string())],
    amountMoney: ['amount_money', lazy(() => moneySchema)],
    referenceId: ['reference_id', optional(nullable(string()))],
    note: ['note', optional(nullable(string()))],
    orderId: ['order_id', optional(nullable(string()))],
    paymentOptions: [
        'payment_options',
        optional(lazy(() => paymentOptionsSchema)),
    ],
    deviceOptions: ['device_options', lazy(() => deviceCheckoutOptionsSchema)],
    deadlineDuration: ['deadline_duration', optional(nullable(string()))],
    status: ['status', optional(string())],
    cancelReason: ['cancel_reason', optional(string())],
    paymentIds: ['payment_ids', optional(array(string()))],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    appId: ['app_id', optional(string())],
    locationId: ['location_id', optional(string())],
    paymentType: ['payment_type', optional(string())],
    teamMemberId: ['team_member_id', optional(nullable(string()))],
    customerId: ['customer_id', optional(nullable(string()))],
    appFeeMoney: ['app_fee_money', optional(lazy(() => moneySchema))],
    statementDescriptionIdentifier: [
        'statement_description_identifier',
        optional(nullable(string())),
    ],
    tipMoney: ['tip_money', optional(lazy(() => moneySchema))],
});

const cancelTerminalCheckoutResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    checkout: ['checkout', optional(lazy(() => terminalCheckoutSchema))],
});

const terminalRefundSchema = object({
    id: ['id', optional(string())],
    refundId: ['refund_id', optional(string())],
    paymentId: ['payment_id', string()],
    orderId: ['order_id', optional(string())],
    amountMoney: ['amount_money', lazy(() => moneySchema)],
    reason: ['reason', string()],
    deviceId: ['device_id', string()],
    deadlineDuration: ['deadline_duration', optional(nullable(string()))],
    status: ['status', optional(string())],
    cancelReason: ['cancel_reason', optional(string())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    appId: ['app_id', optional(string())],
    locationId: ['location_id', optional(string())],
});

const cancelTerminalRefundResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    refund: ['refund', optional(lazy(() => terminalRefundSchema))],
});

const createTerminalActionRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    action: ['action', lazy(() => terminalActionSchema)],
});

const createTerminalActionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    action: ['action', optional(lazy(() => terminalActionSchema))],
});

const createTerminalCheckoutRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    checkout: ['checkout', lazy(() => terminalCheckoutSchema)],
});

const createTerminalCheckoutResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    checkout: ['checkout', optional(lazy(() => terminalCheckoutSchema))],
});

const createTerminalRefundRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    refund: ['refund', optional(lazy(() => terminalRefundSchema))],
});

const createTerminalRefundResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    refund: ['refund', optional(lazy(() => terminalRefundSchema))],
});

const dismissTerminalActionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    action: ['action', optional(lazy(() => terminalActionSchema))],
});

const dismissTerminalCheckoutResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    checkout: ['checkout', optional(lazy(() => terminalCheckoutSchema))],
});

const dismissTerminalRefundResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    refund: ['refund', optional(lazy(() => terminalRefundSchema))],
});

const getTerminalActionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    action: ['action', optional(lazy(() => terminalActionSchema))],
});

const getTerminalCheckoutResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    checkout: ['checkout', optional(lazy(() => terminalCheckoutSchema))],
});

const getTerminalRefundResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    refund: ['refund', optional(lazy(() => terminalRefundSchema))],
});

const terminalActionQueryFilterSchema = object({
    deviceId: ['device_id', optional(nullable(string()))],
    createdAt: ['created_at', optional(lazy(() => timeRangeSchema))],
    status: ['status', optional(nullable(string()))],
    type: ['type', optional(string())],
});

const terminalActionQuerySortSchema = object({ sortOrder: ['sort_order', optional(string())] });

const terminalActionQuerySchema = object({
    filter: ['filter', optional(lazy(() => terminalActionQueryFilterSchema))],
    sort: ['sort', optional(lazy(() => terminalActionQuerySortSchema))],
});

const searchTerminalActionsRequestSchema = object({
    query: ['query', optional(lazy(() => terminalActionQuerySchema))],
    cursor: ['cursor', optional(string())],
    limit: ['limit', optional(number())],
});

const searchTerminalActionsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    action: ['action', optional(array(lazy(() => terminalActionSchema)))],
    cursor: ['cursor', optional(string())],
});

const terminalCheckoutQueryFilterSchema = object({
    deviceId: ['device_id', optional(nullable(string()))],
    createdAt: ['created_at', optional(lazy(() => timeRangeSchema))],
    status: ['status', optional(nullable(string()))],
});

const terminalCheckoutQuerySortSchema = object({ sortOrder: ['sort_order', optional(string())] });

const terminalCheckoutQuerySchema = object({
    filter: ['filter', optional(lazy(() => terminalCheckoutQueryFilterSchema))],
    sort: ['sort', optional(lazy(() => terminalCheckoutQuerySortSchema))],
});

const searchTerminalCheckoutsRequestSchema = object({
    query: ['query', optional(lazy(() => terminalCheckoutQuerySchema))],
    cursor: ['cursor', optional(string())],
    limit: ['limit', optional(number())],
});

const searchTerminalCheckoutsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    checkouts: [
        'checkouts',
        optional(array(lazy(() => terminalCheckoutSchema))),
    ],
    cursor: ['cursor', optional(string())],
});

const terminalRefundQueryFilterSchema = object({
    deviceId: ['device_id', optional(nullable(string()))],
    createdAt: ['created_at', optional(lazy(() => timeRangeSchema))],
    status: ['status', optional(nullable(string()))],
});

const terminalRefundQuerySortSchema = object({ sortOrder: ['sort_order', optional(nullable(string()))] });

const terminalRefundQuerySchema = object({
    filter: ['filter', optional(lazy(() => terminalRefundQueryFilterSchema))],
    sort: ['sort', optional(lazy(() => terminalRefundQuerySortSchema))],
});

const searchTerminalRefundsRequestSchema = object({
    query: ['query', optional(lazy(() => terminalRefundQuerySchema))],
    cursor: ['cursor', optional(string())],
    limit: ['limit', optional(number())],
});

const searchTerminalRefundsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    refunds: ['refunds', optional(array(lazy(() => terminalRefundSchema)))],
    cursor: ['cursor', optional(string())],
});

class TerminalApi extends BaseApi {
    /**
     * Creates a Terminal action request and sends it to the specified device.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                           See the corresponding object definition for field
     *                                                           details.
     * @return Response from the API call
     */
    async createTerminalAction(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/terminals/actions');
        const mapped = req.prepareArgs({
            body: [body, createTerminalActionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createTerminalActionResponseSchema, requestOptions);
    }
    /**
     * Retrieves a filtered list of Terminal action requests created by the account making the request.
     * Terminal action requests are available for 30 days.
     *
     * @param body         An object containing the fields to POST for the
     *                                                            request.  See the corresponding object definition for
     *                                                            field details.
     * @return Response from the API call
     */
    async searchTerminalActions(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/terminals/actions/search');
        const mapped = req.prepareArgs({
            body: [body, searchTerminalActionsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchTerminalActionsResponseSchema, requestOptions);
    }
    /**
     * Retrieves a Terminal action request by `action_id`. Terminal action requests are available for 30
     * days.
     *
     * @param actionId  Unique ID for the desired `TerminalAction`.
     * @return Response from the API call
     */
    async getTerminalAction(actionId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ actionId: [actionId, string()] });
        req.appendTemplatePath `/v2/terminals/actions/${mapped.actionId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getTerminalActionResponseSchema, requestOptions);
    }
    /**
     * Cancels a Terminal action request if the status of the request permits it.
     *
     * @param actionId  Unique ID for the desired `TerminalAction`.
     * @return Response from the API call
     */
    async cancelTerminalAction(actionId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({ actionId: [actionId, string()] });
        req.appendTemplatePath `/v2/terminals/actions/${mapped.actionId}/cancel`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(cancelTerminalActionResponseSchema, requestOptions);
    }
    /**
     * Dismisses a Terminal action request if the status and type of the request permits it.
     *
     * See [Link and Dismiss Actions](https://developer.squareup.com/docs/terminal-api/advanced-
     * features/custom-workflows/link-and-dismiss-actions) for more details.
     *
     * @param actionId  Unique ID for the `TerminalAction` associated with the action to be dismissed.
     * @return Response from the API call
     */
    async dismissTerminalAction(actionId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({ actionId: [actionId, string()] });
        req.appendTemplatePath `/v2/terminals/actions/${mapped.actionId}/dismiss`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(dismissTerminalActionResponseSchema, requestOptions);
    }
    /**
     * Creates a Terminal checkout request and sends it to the specified device to take a payment
     * for the requested amount.
     *
     * @param body         An object containing the fields to POST for the
     *                                                             request.  See the corresponding object definition for
     *                                                             field details.
     * @return Response from the API call
     */
    async createTerminalCheckout(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/terminals/checkouts');
        const mapped = req.prepareArgs({
            body: [body, createTerminalCheckoutRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createTerminalCheckoutResponseSchema, requestOptions);
    }
    /**
     * Returns a filtered list of Terminal checkout requests created by the application making the request.
     * Only Terminal checkout requests created for the merchant scoped to the OAuth token are returned.
     * Terminal checkout requests are available for 30 days.
     *
     * @param body         An object containing the fields to POST for the
     *                                                              request.  See the corresponding object definition for
     *                                                              field details.
     * @return Response from the API call
     */
    async searchTerminalCheckouts(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/terminals/checkouts/search');
        const mapped = req.prepareArgs({
            body: [body, searchTerminalCheckoutsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchTerminalCheckoutsResponseSchema, requestOptions);
    }
    /**
     * Retrieves a Terminal checkout request by `checkout_id`. Terminal checkout requests are available for
     * 30 days.
     *
     * @param checkoutId  The unique ID for the desired `TerminalCheckout`.
     * @return Response from the API call
     */
    async getTerminalCheckout(checkoutId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ checkoutId: [checkoutId, string()] });
        req.appendTemplatePath `/v2/terminals/checkouts/${mapped.checkoutId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getTerminalCheckoutResponseSchema, requestOptions);
    }
    /**
     * Cancels a Terminal checkout request if the status of the request permits it.
     *
     * @param checkoutId  The unique ID for the desired `TerminalCheckout`.
     * @return Response from the API call
     */
    async cancelTerminalCheckout(checkoutId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({ checkoutId: [checkoutId, string()] });
        req.appendTemplatePath `/v2/terminals/checkouts/${mapped.checkoutId}/cancel`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(cancelTerminalCheckoutResponseSchema, requestOptions);
    }
    /**
     * Dismisses a Terminal checkout request if the status and type of the request permits it.
     *
     * @param checkoutId  Unique ID for the `TerminalCheckout` associated with the checkout to be dismissed.
     * @return Response from the API call
     */
    async dismissTerminalCheckout(checkoutId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({ checkoutId: [checkoutId, string()] });
        req.appendTemplatePath `/v2/terminals/checkouts/${mapped.checkoutId}/dismiss`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(dismissTerminalCheckoutResponseSchema, requestOptions);
    }
    /**
     * Creates a request to refund an Interac payment completed on a Square Terminal. Refunds for Interac
     * payments on a Square Terminal are supported only for Interac debit cards in Canada. Other refunds
     * for Terminal payments should use the Refunds API. For more information, see [Refunds
     * API]($e/Refunds).
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                           See the corresponding object definition for field
     *                                                           details.
     * @return Response from the API call
     */
    async createTerminalRefund(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/terminals/refunds');
        const mapped = req.prepareArgs({
            body: [body, createTerminalRefundRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createTerminalRefundResponseSchema, requestOptions);
    }
    /**
     * Retrieves a filtered list of Interac Terminal refund requests created by the seller making the
     * request. Terminal refund requests are available for 30 days.
     *
     * @param body         An object containing the fields to POST for the
     *                                                            request.  See the corresponding object definition for
     *                                                            field details.
     * @return Response from the API call
     */
    async searchTerminalRefunds(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/terminals/refunds/search');
        const mapped = req.prepareArgs({
            body: [body, searchTerminalRefundsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchTerminalRefundsResponseSchema, requestOptions);
    }
    /**
     * Retrieves an Interac Terminal refund object by ID. Terminal refund objects are available for 30 days.
     *
     * @param terminalRefundId   The unique ID for the desired `TerminalRefund`.
     * @return Response from the API call
     */
    async getTerminalRefund(terminalRefundId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            terminalRefundId: [terminalRefundId, string()],
        });
        req.appendTemplatePath `/v2/terminals/refunds/${mapped.terminalRefundId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(getTerminalRefundResponseSchema, requestOptions);
    }
    /**
     * Cancels an Interac Terminal refund request by refund request ID if the status of the request permits
     * it.
     *
     * @param terminalRefundId   The unique ID for the desired `TerminalRefund`.
     * @return Response from the API call
     */
    async cancelTerminalRefund(terminalRefundId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            terminalRefundId: [terminalRefundId, string()],
        });
        req.appendTemplatePath `/v2/terminals/refunds/${mapped.terminalRefundId}/cancel`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(cancelTerminalRefundResponseSchema, requestOptions);
    }
    /**
     * Dismisses a Terminal refund request if the status and type of the request permits it.
     *
     * @param terminalRefundId   Unique ID for the `TerminalRefund` associated with the refund to be dismissed.
     * @return Response from the API call
     */
    async dismissTerminalRefund(terminalRefundId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            terminalRefundId: [terminalRefundId, string()],
        });
        req.appendTemplatePath `/v2/terminals/refunds/${mapped.terminalRefundId}/dismiss`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(dismissTerminalRefundResponseSchema, requestOptions);
    }
}

const captureTransactionResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const transactionSchema = object({
    id: ['id', optional(string())],
    locationId: ['location_id', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
    tenders: ['tenders', optional(nullable(array(lazy(() => tenderSchema))))],
    refunds: ['refunds', optional(nullable(array(lazy(() => refundSchema))))],
    referenceId: ['reference_id', optional(nullable(string()))],
    product: ['product', optional(string())],
    clientId: ['client_id', optional(nullable(string()))],
    shippingAddress: ['shipping_address', optional(lazy(() => addressSchema))],
    orderId: ['order_id', optional(nullable(string()))],
});

const listTransactionsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    transactions: [
        'transactions',
        optional(array(lazy(() => transactionSchema))),
    ],
    cursor: ['cursor', optional(string())],
});

const retrieveTransactionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    transaction: ['transaction', optional(lazy(() => transactionSchema))],
});

const voidTransactionResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

class TransactionsApi extends BaseApi {
    /**
     * Lists transactions for a particular location.
     *
     * Transactions include payment information from sales and exchanges and refund
     * information from returns and exchanges.
     *
     * Max results per [page](https://developer.squareup.com/docs/working-with-apis/pagination): 50
     *
     * @param locationId  The ID of the location to list transactions for.
     * @param beginTime   The beginning of the requested reporting period, in RFC 3339 format.  See [Date
     *                              ranges](https://developer.squareup.com/docs/build-basics/working-with-dates) for
     *                              details on date inclusivity/exclusivity.  Default value: The current time minus one
     *                              year.
     * @param endTime     The end of the requested reporting period, in RFC 3339 format.  See [Date
     *                              ranges](https://developer.squareup.com/docs/build-basics/working-with-dates) for
     *                              details on date inclusivity/exclusivity.  Default value: The current time.
     * @param sortOrder   The order in which results are listed in the response (`ASC` for oldest first,
     *                              `DESC` for newest first).  Default value: `DESC`
     * @param cursor      A pagination cursor returned by a previous call to this endpoint. Provide this to
     *                              retrieve the next set of results for your original query.  See [Paginating
     *                              results](https://developer.squareup.com/docs/working-with-apis/pagination) for more
     *                              information.
     * @return Response from the API call
     * @deprecated
     */
    async listTransactions(locationId, beginTime, endTime, sortOrder, cursor, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            beginTime: [beginTime, optional(string())],
            endTime: [endTime, optional(string())],
            sortOrder: [sortOrder, optional(string())],
            cursor: [cursor, optional(string())],
        });
        req.query('begin_time', mapped.beginTime);
        req.query('end_time', mapped.endTime);
        req.query('sort_order', mapped.sortOrder);
        req.query('cursor', mapped.cursor);
        req.appendTemplatePath `/v2/locations/${mapped.locationId}/transactions`;
        req.deprecated('TransactionsApi.listTransactions');
        req.authenticate([{ global: true }]);
        return req.callAsJson(listTransactionsResponseSchema, requestOptions);
    }
    /**
     * Retrieves details for a single transaction.
     *
     * @param locationId     The ID of the transaction's associated location.
     * @param transactionId  The ID of the transaction to retrieve.
     * @return Response from the API call
     * @deprecated
     */
    async retrieveTransaction(locationId, transactionId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            transactionId: [transactionId, string()],
        });
        req.appendTemplatePath `/v2/locations/${mapped.locationId}/transactions/${mapped.transactionId}`;
        req.deprecated('TransactionsApi.retrieveTransaction');
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveTransactionResponseSchema, requestOptions);
    }
    /**
     * Captures a transaction that was created with the [Charge](api-endpoint:Transactions-Charge)
     * endpoint with a `delay_capture` value of `true`.
     *
     *
     * See [Delayed capture transactions](https://developer.squareup.
     * com/docs/payments/transactions/overview#delayed-capture)
     * for more information.
     *
     * @param locationId
     * @param transactionId
     * @return Response from the API call
     * @deprecated
     */
    async captureTransaction(locationId, transactionId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            transactionId: [transactionId, string()],
        });
        req.appendTemplatePath `/v2/locations/${mapped.locationId}/transactions/${mapped.transactionId}/capture`;
        req.deprecated('TransactionsApi.captureTransaction');
        req.authenticate([{ global: true }]);
        return req.callAsJson(captureTransactionResponseSchema, requestOptions);
    }
    /**
     * Cancels a transaction that was created with the [Charge](api-endpoint:Transactions-Charge)
     * endpoint with a `delay_capture` value of `true`.
     *
     *
     * See [Delayed capture transactions](https://developer.squareup.
     * com/docs/payments/transactions/overview#delayed-capture)
     * for more information.
     *
     * @param locationId
     * @param transactionId
     * @return Response from the API call
     * @deprecated
     */
    async voidTransaction(locationId, transactionId, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            transactionId: [transactionId, string()],
        });
        req.appendTemplatePath `/v2/locations/${mapped.locationId}/transactions/${mapped.transactionId}/void`;
        req.deprecated('TransactionsApi.voidTransaction');
        req.authenticate([{ global: true }]);
        return req.callAsJson(voidTransactionResponseSchema, requestOptions);
    }
}

const v1MoneySchema = object({
    amount: ['amount', optional(nullable(number()))],
    currencyCode: ['currency_code', optional(string())],
});

const v1OrderHistoryEntrySchema = object({
    action: ['action', optional(string())],
    createdAt: ['created_at', optional(string())],
});

const v1TenderSchema = object({
    id: ['id', optional(string())],
    type: ['type', optional(string())],
    name: ['name', optional(nullable(string()))],
    employeeId: ['employee_id', optional(nullable(string()))],
    receiptUrl: ['receipt_url', optional(nullable(string()))],
    cardBrand: ['card_brand', optional(string())],
    panSuffix: ['pan_suffix', optional(nullable(string()))],
    entryMethod: ['entry_method', optional(string())],
    paymentNote: ['payment_note', optional(nullable(string()))],
    totalMoney: ['total_money', optional(lazy(() => v1MoneySchema))],
    tenderedMoney: ['tendered_money', optional(lazy(() => v1MoneySchema))],
    tenderedAt: ['tendered_at', optional(nullable(string()))],
    settledAt: ['settled_at', optional(nullable(string()))],
    changeBackMoney: ['change_back_money', optional(lazy(() => v1MoneySchema))],
    refundedMoney: ['refunded_money', optional(lazy(() => v1MoneySchema))],
    isExchange: ['is_exchange', optional(nullable(boolean()))],
});

const v1OrderSchema = object({
    errors: ['errors', optional(nullable(array(lazy(() => errorSchema))))],
    id: ['id', optional(string())],
    buyerEmail: ['buyer_email', optional(nullable(string()))],
    recipientName: ['recipient_name', optional(nullable(string()))],
    recipientPhoneNumber: [
        'recipient_phone_number',
        optional(nullable(string())),
    ],
    state: ['state', optional(string())],
    shippingAddress: ['shipping_address', optional(lazy(() => addressSchema))],
    subtotalMoney: ['subtotal_money', optional(lazy(() => v1MoneySchema))],
    totalShippingMoney: [
        'total_shipping_money',
        optional(lazy(() => v1MoneySchema)),
    ],
    totalTaxMoney: ['total_tax_money', optional(lazy(() => v1MoneySchema))],
    totalPriceMoney: ['total_price_money', optional(lazy(() => v1MoneySchema))],
    totalDiscountMoney: [
        'total_discount_money',
        optional(lazy(() => v1MoneySchema)),
    ],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    expiresAt: ['expires_at', optional(nullable(string()))],
    paymentId: ['payment_id', optional(nullable(string()))],
    buyerNote: ['buyer_note', optional(nullable(string()))],
    completedNote: ['completed_note', optional(nullable(string()))],
    refundedNote: ['refunded_note', optional(nullable(string()))],
    canceledNote: ['canceled_note', optional(nullable(string()))],
    tender: ['tender', optional(lazy(() => v1TenderSchema))],
    orderHistory: [
        'order_history',
        optional(nullable(array(lazy(() => v1OrderHistoryEntrySchema)))),
    ],
    promoCode: ['promo_code', optional(nullable(string()))],
    btcReceiveAddress: ['btc_receive_address', optional(nullable(string()))],
    btcPriceSatoshi: ['btc_price_satoshi', optional(nullable(number()))],
});

const v1UpdateOrderRequestSchema = object({
    action: ['action', string()],
    shippedTrackingNumber: [
        'shipped_tracking_number',
        optional(nullable(string())),
    ],
    completedNote: ['completed_note', optional(nullable(string()))],
    refundedNote: ['refunded_note', optional(nullable(string()))],
    canceledNote: ['canceled_note', optional(nullable(string()))],
});

class V1TransactionsApi extends BaseApi {
    /**
     * Provides summary information for a merchant's online store orders.
     *
     * @param locationId  The ID of the location to list online store orders for.
     * @param order       The order in which payments are listed in the response.
     * @param limit       The maximum number of payments to return in a single response. This value cannot
     *                              exceed 200.
     * @param batchToken  A pagination cursor to retrieve the next set of results for your original query to
     *                              the endpoint.
     * @return Response from the API call
     * @deprecated
     */
    async v1ListOrders(locationId, order, limit, batchToken, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            order: [order, optional(string())],
            limit: [limit, optional(number())],
            batchToken: [batchToken, optional(string())],
        });
        req.query('order', mapped.order);
        req.query('limit', mapped.limit);
        req.query('batch_token', mapped.batchToken);
        req.appendTemplatePath `/v1/${mapped.locationId}/orders`;
        req.deprecated('V1TransactionsApi.v1ListOrders');
        req.authenticate([{ global: true }]);
        return req.callAsJson(array(v1OrderSchema), requestOptions);
    }
    /**
     * Provides comprehensive information for a single online store order, including the order's history.
     *
     * @param locationId  The ID of the order's associated location.
     * @param orderId     The order's Square-issued ID. You obtain this value from Order objects returned by
     *                              the List Orders endpoint
     * @return Response from the API call
     * @deprecated
     */
    async v1RetrieveOrder(locationId, orderId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            orderId: [orderId, string()],
        });
        req.appendTemplatePath `/v1/${mapped.locationId}/orders/${mapped.orderId}`;
        req.deprecated('V1TransactionsApi.v1RetrieveOrder');
        req.authenticate([{ global: true }]);
        return req.callAsJson(v1OrderSchema, requestOptions);
    }
    /**
     * Updates the details of an online store order. Every update you perform on an order corresponds to
     * one of three actions:
     *
     * @param locationId   The ID of the order's associated location.
     * @param orderId      The order's Square-issued ID. You obtain this value from Order
     *                                                    objects returned by the List Orders endpoint
     * @param body         An object containing the fields to POST for the request.  See
     *                                                    the corresponding object definition for field details.
     * @return Response from the API call
     * @deprecated
     */
    async v1UpdateOrder(locationId, orderId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            locationId: [locationId, string()],
            orderId: [orderId, string()],
            body: [body, v1UpdateOrderRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v1/${mapped.locationId}/orders/${mapped.orderId}`;
        req.deprecated('V1TransactionsApi.v1UpdateOrder');
        req.authenticate([{ global: true }]);
        return req.callAsJson(v1OrderSchema, requestOptions);
    }
}

const vendorContactSchema = object({
    id: ['id', optional(string())],
    name: ['name', optional(nullable(string()))],
    emailAddress: ['email_address', optional(nullable(string()))],
    phoneNumber: ['phone_number', optional(nullable(string()))],
    removed: ['removed', optional(nullable(boolean()))],
    ordinal: ['ordinal', number()],
});

const vendorSchema = object({
    id: ['id', optional(string())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
    name: ['name', optional(nullable(string()))],
    address: ['address', optional(lazy(() => addressSchema))],
    contacts: [
        'contacts',
        optional(nullable(array(lazy(() => vendorContactSchema)))),
    ],
    accountNumber: ['account_number', optional(nullable(string()))],
    note: ['note', optional(nullable(string()))],
    version: ['version', optional(number())],
    status: ['status', optional(string())],
});

const bulkCreateVendorsRequestSchema = object({ vendors: ['vendors', dict(lazy(() => vendorSchema))] });

const createVendorResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    vendor: ['vendor', optional(lazy(() => vendorSchema))],
});

const bulkCreateVendorsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    responses: [
        'responses',
        optional(dict(lazy(() => createVendorResponseSchema))),
    ],
});

const bulkRetrieveVendorsRequestSchema = object({ vendorIds: ['vendor_ids', optional(nullable(array(string())))] });

const retrieveVendorResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    vendor: ['vendor', optional(lazy(() => vendorSchema))],
});

const bulkRetrieveVendorsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    responses: [
        'responses',
        optional(dict(lazy(() => retrieveVendorResponseSchema))),
    ],
});

const updateVendorRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(nullable(string()))],
    vendor: ['vendor', lazy(() => vendorSchema)],
});

const bulkUpdateVendorsRequestSchema = object({ vendors: ['vendors', dict(lazy(() => updateVendorRequestSchema))] });

const updateVendorResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    vendor: ['vendor', optional(lazy(() => vendorSchema))],
});

const bulkUpdateVendorsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    responses: [
        'responses',
        optional(dict(lazy(() => updateVendorResponseSchema))),
    ],
});

const createVendorRequestSchema = object({
    idempotencyKey: ['idempotency_key', string()],
    vendor: ['vendor', optional(lazy(() => vendorSchema))],
});

const searchVendorsRequestFilterSchema = object({
    name: ['name', optional(nullable(array(string())))],
    status: ['status', optional(nullable(array(string())))],
});

const searchVendorsRequestSortSchema = object({ field: ['field', optional(string())], order: ['order', optional(string())] });

const searchVendorsRequestSchema = object({
    filter: ['filter', optional(lazy(() => searchVendorsRequestFilterSchema))],
    sort: ['sort', optional(lazy(() => searchVendorsRequestSortSchema))],
    cursor: ['cursor', optional(string())],
});

const searchVendorsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    vendors: ['vendors', optional(array(lazy(() => vendorSchema)))],
    cursor: ['cursor', optional(string())],
});

class VendorsApi extends BaseApi {
    /**
     * Creates one or more [Vendor]($m/Vendor) objects to represent suppliers to a seller.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                        See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async bulkCreateVendors(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/vendors/bulk-create');
        const mapped = req.prepareArgs({
            body: [body, bulkCreateVendorsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkCreateVendorsResponseSchema, requestOptions);
    }
    /**
     * Retrieves one or more vendors of specified [Vendor]($m/Vendor) IDs.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                          See the corresponding object definition for field
     *                                                          details.
     * @return Response from the API call
     */
    async bulkRetrieveVendors(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/vendors/bulk-retrieve');
        const mapped = req.prepareArgs({
            body: [body, bulkRetrieveVendorsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkRetrieveVendorsResponseSchema, requestOptions);
    }
    /**
     * Updates one or more of existing [Vendor]($m/Vendor) objects as suppliers to a seller.
     *
     * @param body         An object containing the fields to POST for the request.
     *                                                        See the corresponding object definition for field details.
     * @return Response from the API call
     */
    async bulkUpdateVendors(body, requestOptions) {
        const req = this.createRequest('PUT', '/v2/vendors/bulk-update');
        const mapped = req.prepareArgs({
            body: [body, bulkUpdateVendorsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(bulkUpdateVendorsResponseSchema, requestOptions);
    }
    /**
     * Creates a single [Vendor]($m/Vendor) object to represent a supplier to a seller.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                   the corresponding object definition for field details.
     * @return Response from the API call
     */
    async createVendor(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/vendors/create');
        const mapped = req.prepareArgs({ body: [body, createVendorRequestSchema] });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createVendorResponseSchema, requestOptions);
    }
    /**
     * Searches for vendors using a filter against supported [Vendor]($m/Vendor) properties and a supported
     * sorter.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                    the corresponding object definition for field details.
     * @return Response from the API call
     */
    async searchVendors(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/vendors/search');
        const mapped = req.prepareArgs({
            body: [body, searchVendorsRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(searchVendorsResponseSchema, requestOptions);
    }
    /**
     * Retrieves the vendor of a specified [Vendor]($m/Vendor) ID.
     *
     * @param vendorId  ID of the [Vendor](entity:Vendor) to retrieve.
     * @return Response from the API call
     */
    async retrieveVendor(vendorId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({ vendorId: [vendorId, string()] });
        req.appendTemplatePath `/v2/vendors/${mapped.vendorId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveVendorResponseSchema, requestOptions);
    }
    /**
     * Updates an existing [Vendor]($m/Vendor) object as a supplier to a seller.
     *
     * @param body         An object containing the fields to POST for the request.  See
     *                                                   the corresponding object definition for field details.
     * @param vendorId
     * @return Response from the API call
     */
    async updateVendor(body, vendorId, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            body: [body, updateVendorRequestSchema],
            vendorId: [vendorId, string()],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/vendors/${mapped.vendorId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateVendorResponseSchema, requestOptions);
    }
}

const webhookSubscriptionSchema = object({
    id: ['id', optional(string())],
    name: ['name', optional(nullable(string()))],
    enabled: ['enabled', optional(nullable(boolean()))],
    eventTypes: ['event_types', optional(nullable(array(string())))],
    notificationUrl: ['notification_url', optional(nullable(string()))],
    apiVersion: ['api_version', optional(nullable(string()))],
    signatureKey: ['signature_key', optional(string())],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
});

const createWebhookSubscriptionRequestSchema = object({
    idempotencyKey: ['idempotency_key', optional(string())],
    subscription: ['subscription', lazy(() => webhookSubscriptionSchema)],
});

const createWebhookSubscriptionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscription: [
        'subscription',
        optional(lazy(() => webhookSubscriptionSchema)),
    ],
});

const deleteWebhookSubscriptionResponseSchema = object({ errors: ['errors', optional(array(lazy(() => errorSchema)))] });

const listWebhookEventTypesResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    eventTypes: ['event_types', optional(array(string()))],
    metadata: [
        'metadata',
        optional(array(lazy(() => eventTypeMetadataSchema))),
    ],
});

const listWebhookSubscriptionsResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscriptions: [
        'subscriptions',
        optional(array(lazy(() => webhookSubscriptionSchema))),
    ],
    cursor: ['cursor', optional(string())],
});

const retrieveWebhookSubscriptionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscription: [
        'subscription',
        optional(lazy(() => webhookSubscriptionSchema)),
    ],
});

const testWebhookSubscriptionRequestSchema = object({ eventType: ['event_type', optional(nullable(string()))] });

const subscriptionTestResultSchema = object({
    id: ['id', optional(string())],
    statusCode: ['status_code', optional(nullable(number()))],
    payload: ['payload', optional(nullable(string()))],
    createdAt: ['created_at', optional(string())],
    updatedAt: ['updated_at', optional(string())],
});

const testWebhookSubscriptionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscriptionTestResult: [
        'subscription_test_result',
        optional(lazy(() => subscriptionTestResultSchema)),
    ],
});

const updateWebhookSubscriptionRequestSchema = object({
    subscription: [
        'subscription',
        optional(lazy(() => webhookSubscriptionSchema)),
    ],
});

const updateWebhookSubscriptionResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    subscription: [
        'subscription',
        optional(lazy(() => webhookSubscriptionSchema)),
    ],
});

const updateWebhookSubscriptionSignatureKeyRequestSchema = object({ idempotencyKey: ['idempotency_key', optional(nullable(string()))] });

const updateWebhookSubscriptionSignatureKeyResponseSchema = object({
    errors: ['errors', optional(array(lazy(() => errorSchema)))],
    signatureKey: ['signature_key', optional(string())],
});

class WebhookSubscriptionsApi extends BaseApi {
    /**
     * Lists all webhook event types that can be subscribed to.
     *
     * @param apiVersion  The API version for which to list event types. Setting this field overrides the
     *                              default version used by the application.
     * @return Response from the API call
     */
    async listWebhookEventTypes(apiVersion, requestOptions) {
        const req = this.createRequest('GET', '/v2/webhooks/event-types');
        const mapped = req.prepareArgs({
            apiVersion: [apiVersion, optional(string())],
        });
        req.query('api_version', mapped.apiVersion);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listWebhookEventTypesResponseSchema, requestOptions);
    }
    /**
     * Lists all webhook subscriptions owned by your application.
     *
     * @param cursor           A pagination cursor returned by a previous call to this endpoint. Provide this
     *                                    to retrieve the next set of results for your original query.  For more
     *                                    information, see [Pagination](https://developer.squareup.com/docs/build-
     *                                    basics/common-api-patterns/pagination).
     * @param includeDisabled  Includes disabled [Subscription](entity:WebhookSubscription)s. By default, all
     *                                    enabled [Subscription](entity:WebhookSubscription)s are returned.
     * @param sortOrder        Sorts the returned list by when the [Subscription](entity:WebhookSubscription)
     *                                    was created with the specified order. This field defaults to ASC.
     * @param limit            The maximum number of results to be returned in a single page. It is possible
     *                                    to receive fewer results than the specified limit on a given page. The default
     *                                    value of 100 is also the maximum allowed value.  Default: 100
     * @return Response from the API call
     */
    async listWebhookSubscriptions(cursor, includeDisabled, sortOrder, limit, requestOptions) {
        const req = this.createRequest('GET', '/v2/webhooks/subscriptions');
        const mapped = req.prepareArgs({
            cursor: [cursor, optional(string())],
            includeDisabled: [includeDisabled, optional(boolean())],
            sortOrder: [sortOrder, optional(string())],
            limit: [limit, optional(number())],
        });
        req.query('cursor', mapped.cursor);
        req.query('include_disabled', mapped.includeDisabled);
        req.query('sort_order', mapped.sortOrder);
        req.query('limit', mapped.limit);
        req.authenticate([{ global: true }]);
        return req.callAsJson(listWebhookSubscriptionsResponseSchema, requestOptions);
    }
    /**
     * Creates a webhook subscription.
     *
     * @param body         An object containing the fields to POST for the
     *                                                                request.  See the corresponding object definition
     *                                                                for field details.
     * @return Response from the API call
     */
    async createWebhookSubscription(body, requestOptions) {
        const req = this.createRequest('POST', '/v2/webhooks/subscriptions');
        const mapped = req.prepareArgs({
            body: [body, createWebhookSubscriptionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.authenticate([{ global: true }]);
        return req.callAsJson(createWebhookSubscriptionResponseSchema, requestOptions);
    }
    /**
     * Deletes a webhook subscription.
     *
     * @param subscriptionId  [REQUIRED] The ID of the [Subscription](entity:WebhookSubscription) to delete.
     * @return Response from the API call
     */
    async deleteWebhookSubscription(subscriptionId, requestOptions) {
        const req = this.createRequest('DELETE');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
        });
        req.appendTemplatePath `/v2/webhooks/subscriptions/${mapped.subscriptionId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(deleteWebhookSubscriptionResponseSchema, requestOptions);
    }
    /**
     * Retrieves a webhook subscription identified by its ID.
     *
     * @param subscriptionId  [REQUIRED] The ID of the [Subscription](entity:WebhookSubscription) to retrieve.
     * @return Response from the API call
     */
    async retrieveWebhookSubscription(subscriptionId, requestOptions) {
        const req = this.createRequest('GET');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
        });
        req.appendTemplatePath `/v2/webhooks/subscriptions/${mapped.subscriptionId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(retrieveWebhookSubscriptionResponseSchema, requestOptions);
    }
    /**
     * Updates a webhook subscription.
     *
     * @param subscriptionId  [REQUIRED] The ID of the [Subscription](entity:
     *                                                                   WebhookSubscription) to update.
     * @param body            An object containing the fields to POST for the
     *                                                                   request.  See the corresponding object
     *                                                                   definition for field details.
     * @return Response from the API call
     */
    async updateWebhookSubscription(subscriptionId, body, requestOptions) {
        const req = this.createRequest('PUT');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
            body: [body, updateWebhookSubscriptionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/webhooks/subscriptions/${mapped.subscriptionId}`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateWebhookSubscriptionResponseSchema, requestOptions);
    }
    /**
     * Updates a webhook subscription by replacing the existing signature key with a new one.
     *
     * @param subscriptionId  [REQUIRED] The ID of the
     *                                                                               [Subscription](entity:
     *                                                                               WebhookSubscription) to update.
     * @param body            An object containing the fields to
     *                                                                               POST for the request.  See the
     *                                                                               corresponding object definition for
     *                                                                               field details.
     * @return Response from the API call
     */
    async updateWebhookSubscriptionSignatureKey(subscriptionId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
            body: [body, updateWebhookSubscriptionSignatureKeyRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/webhooks/subscriptions/${mapped.subscriptionId}/signature-key`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(updateWebhookSubscriptionSignatureKeyResponseSchema, requestOptions);
    }
    /**
     * Tests a webhook subscription by sending a test event to the notification URL.
     *
     * @param subscriptionId  [REQUIRED] The ID of the [Subscription](entity:
     *                                                                 WebhookSubscription) to test.
     * @param body            An object containing the fields to POST for the
     *                                                                 request.  See the corresponding object definition
     *                                                                 for field details.
     * @return Response from the API call
     */
    async testWebhookSubscription(subscriptionId, body, requestOptions) {
        const req = this.createRequest('POST');
        const mapped = req.prepareArgs({
            subscriptionId: [subscriptionId, string()],
            body: [body, testWebhookSubscriptionRequestSchema],
        });
        req.header('Content-Type', 'application/json');
        req.json(mapped.body);
        req.appendTemplatePath `/v2/webhooks/subscriptions/${mapped.subscriptionId}/test`;
        req.authenticate([{ global: true }]);
        return req.callAsJson(testWebhookSubscriptionResponseSchema, requestOptions);
    }
}

function createAuthProviderFromConfig(config) {
    const authConfig = {
        global: config.bearerAuthCredentials &&
            accessTokenAuthenticationProvider(config.bearerAuthCredentials),
    };
    return compositeAuthenticationProvider(authConfig);
}

/** Environments available for API */
var Environment;
(function (Environment) {
    Environment["Production"] = "production";
    Environment["Sandbox"] = "sandbox";
    Environment["Custom"] = "custom";
})(Environment || (Environment = {}));

/** Default values for the configuration parameters of the client. */
const DEFAULT_CONFIGURATION = {
    timeout: 60000,
    squareVersion: '2024-10-17',
    additionalHeaders: {},
    userAgentDetail: '',
    environment: Environment.Production,
    customUrl: 'https://connect.squareup.com',
};
/** Default values for retry configuration parameters. */
const DEFAULT_RETRY_CONFIG = {
    maxNumberOfRetries: 0,
    retryOnTimeout: true,
    retryInterval: 1,
    maximumRetryWaitTime: 0,
    backoffFactor: 2,
    httpStatusCodesToRetry: [408, 413, 429, 500, 502, 503, 504, 521, 522, 524],
    httpMethodsToRetry: ['GET', 'PUT'],
};

/**
 * Thrown when the HTTP status code is not okay.
 *
 * The ApiError extends the ApiResponse interface, so all ApiResponse
 * properties are available.
 */
class ApiError extends Error {
    constructor(context, message) {
        var _a;
        super(message);
        Object.setPrototypeOf(this, new.target.prototype);
        const { request, response } = context;
        this.request = request;
        this.statusCode = response.statusCode;
        this.headers = response.headers;
        this.body = response.body;
        if (typeof response.body === 'string' && response.body !== '') {
            const JSON = JSONBig();
            try {
                this.result = JSON.parse(response.body);
                if (typeof this.result === 'object') {
                    const result = this.result;
                    if ('errors' in result) {
                        this.errors = result['errors'];
                    }
                    else {
                        this.errors = [
                            {
                                category: 'V1_ERROR',
                                code: (_a = result['type']) !== null && _a !== void 0 ? _a : 'Unknown',
                                detail: result['message'],
                                field: result['field'],
                            },
                        ];
                    }
                }
            }
            catch (error) {
                if (process.env.NODE_ENV !== 'production') {
                    if (console) {
                        console.warn(`Unexpected error: Could not parse HTTP response body as JSON. ${error}`);
                    }
                }
            }
        }
    }
}

class Client {
    constructor(config) {
        var _a, _b, _c, _d;
        this._config = Object.assign(Object.assign({}, DEFAULT_CONFIGURATION), config);
        this._retryConfig = Object.assign(Object.assign({}, DEFAULT_RETRY_CONFIG), (_a = this._config.httpClientOptions) === null || _a === void 0 ? void 0 : _a.retryConfig);
        this._timeout =
            typeof ((_b = this._config.httpClientOptions) === null || _b === void 0 ? void 0 : _b.timeout) != 'undefined'
                ? this._config.httpClientOptions.timeout
                : this._config.timeout;
        const clonedConfig = Object.assign(Object.assign({}, this._config), { bearerAuthCredentials: this._config.bearerAuthCredentials || {
                accessToken: this._config.accessToken || '',
            } });
        this._userAgent = updateUserAgent('Square-TypeScript-SDK/38.2.0 ({api-version}) {engine}/{engine-version} ({os-info}) {detail}', this._config.squareVersion, this._config.userAgentDetail);
        this._requestBuilderFactory = createRequestHandlerFactory((server) => getBaseUri(server, this._config), createAuthProviderFromConfig(clonedConfig), new HttpClient(AbortError, {
            timeout: this._timeout,
            clientConfigOverrides: this._config.unstable_httpClientOptions,
            httpAgent: (_c = this._config.httpClientOptions) === null || _c === void 0 ? void 0 : _c.httpAgent,
            httpsAgent: (_d = this._config.httpClientOptions) === null || _d === void 0 ? void 0 : _d.httpsAgent,
        }), [
            withErrorHandlers,
            withUserAgent(this._userAgent),
            withAdditionalHeaders(this._config),
            withAuthenticationByDefault,
            withSquareVersion(this._config),
        ], this._retryConfig);
        this.applePayApi = new ApplePayApi(this);
        this.bankAccountsApi = new BankAccountsApi(this);
        this.bookingCustomAttributesApi = new BookingCustomAttributesApi(this);
        this.bookingsApi = new BookingsApi(this);
        this.cardsApi = new CardsApi(this);
        this.cashDrawersApi = new CashDrawersApi(this);
        this.catalogApi = new CatalogApi(this);
        this.checkoutApi = new CheckoutApi(this);
        this.customerCustomAttributesApi = new CustomerCustomAttributesApi(this);
        this.customerGroupsApi = new CustomerGroupsApi(this);
        this.customersApi = new CustomersApi(this);
        this.customerSegmentsApi = new CustomerSegmentsApi(this);
        this.devicesApi = new DevicesApi(this);
        this.disputesApi = new DisputesApi(this);
        this.employeesApi = new EmployeesApi(this);
        this.eventsApi = new EventsApi(this);
        this.giftCardActivitiesApi = new GiftCardActivitiesApi(this);
        this.giftCardsApi = new GiftCardsApi(this);
        this.inventoryApi = new InventoryApi(this);
        this.invoicesApi = new InvoicesApi(this);
        this.laborApi = new LaborApi(this);
        this.locationCustomAttributesApi = new LocationCustomAttributesApi(this);
        this.locationsApi = new LocationsApi(this);
        this.loyaltyApi = new LoyaltyApi(this);
        this.merchantCustomAttributesApi = new MerchantCustomAttributesApi(this);
        this.merchantsApi = new MerchantsApi(this);
        this.mobileAuthorizationApi = new MobileAuthorizationApi(this);
        this.oAuthApi = new OAuthApi(this);
        this.orderCustomAttributesApi = new OrderCustomAttributesApi(this);
        this.ordersApi = new OrdersApi(this);
        this.paymentsApi = new PaymentsApi(this);
        this.payoutsApi = new PayoutsApi(this);
        this.refundsApi = new RefundsApi(this);
        this.sitesApi = new SitesApi(this);
        this.snippetsApi = new SnippetsApi(this);
        this.subscriptionsApi = new SubscriptionsApi(this);
        this.teamApi = new TeamApi(this);
        this.terminalApi = new TerminalApi(this);
        this.transactionsApi = new TransactionsApi(this);
        this.v1TransactionsApi = new V1TransactionsApi(this);
        this.vendorsApi = new VendorsApi(this);
        this.webhookSubscriptionsApi = new WebhookSubscriptionsApi(this);
    }
    getRequestBuilderFactory() {
        return this._requestBuilderFactory;
    }
    /**
     * Clone this client and override given configuration options
     */
    withConfiguration(config) {
        return new Client(Object.assign(Object.assign({}, this._config), config));
    }
}
function createHttpClientAdapter(client) {
    return async (request, requestOptions) => {
        return await client.executeRequest(request, requestOptions);
    };
}
function getBaseUri(server = 'default', config) {
    if (config.environment === Environment.Production) {
        if (server === 'default') {
            return 'https://connect.squareup.com';
        }
    }
    if (config.environment === Environment.Sandbox) {
        if (server === 'default') {
            return 'https://connect.squareupsandbox.com';
        }
    }
    if (config.environment === Environment.Custom) {
        if (server === 'default') {
            return pathTemplate `${new SkipEncode(config.customUrl)}`;
        }
    }
    throw new Error('Could not get Base URL. Invalid environment or server.');
}
function createRequestHandlerFactory(baseUrlProvider, authProvider, httpClient, addons, retryConfig) {
    const requestBuilderFactory = createRequestBuilderFactory(createHttpClientAdapter(httpClient), baseUrlProvider, ApiError, authProvider, retryConfig);
    return tap(requestBuilderFactory, ...addons);
}
function tap(requestBuilderFactory, ...callback) {
    return (...args) => {
        const requestBuilder = requestBuilderFactory(...args);
        callback.forEach((c) => c(requestBuilder));
        return requestBuilder;
    };
}
function withErrorHandlers(rb) {
    rb.defaultToError(ApiError);
}
function withAdditionalHeaders({ additionalHeaders, }) {
    const clone = Object.assign({}, additionalHeaders);
    assertHeaders(clone);
    return (rb) => {
        rb.interceptRequest((request) => {
            var _a;
            const headers = (_a = request.headers) !== null && _a !== void 0 ? _a : {};
            mergeHeaders(headers, clone);
            return Object.assign(Object.assign({}, request), { headers });
        });
    };
}
function withUserAgent(userAgent) {
    return (rb) => {
        rb.interceptRequest((request) => {
            var _a;
            const headers = (_a = request.headers) !== null && _a !== void 0 ? _a : {};
            setHeader(headers, 'user-agent', userAgent);
            return Object.assign(Object.assign({}, request), { headers });
        });
    };
}
function withSquareVersion({ squareVersion }) {
    return (rb) => {
        rb.interceptRequest((request) => {
            var _a;
            const headers = (_a = request.headers) !== null && _a !== void 0 ? _a : {};
            setHeader(headers, 'Square-Version', squareVersion);
            return Object.assign(Object.assign({}, request), { headers });
        });
    };
}
function withAuthenticationByDefault(rb) {
    rb.authenticate([]);
}

export { Client as C, Environment as E };
