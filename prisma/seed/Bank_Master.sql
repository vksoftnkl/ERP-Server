-- Seed: fixed.bank_master
-- Banks operating in India, grouped the way the RBI classifies them:
--   Public Sector (12), Private Sector (21), Small Finance (12), Payments (6),
--   Regional Rural Banks (28, post "One State One RRB" amalgamation of 01-05-2025),
--   Foreign banks with an India presence, major Urban/State Co-operative banks,
--   and merged/defunct banks kept inactive so legacy vouchers still resolve.
--
-- Column notes:
--   * bnk_id is omitted -- the column defaults to uuidv7().
--   * bnk_rbi_code holds the 4-character IFSC bank prefix (SBIN, HDFC, ...), which
--     is the identifier actually used for NEFT/RTGS/IMPS routing in India. It is
--     left NULL where the prefix could not be confirmed -- notably for the RRBs,
--     which were re-issued IFSC ranges after the 2025 amalgamation. Fill those
--     from the current NPCI/RBI IFSC list rather than guessing.
--   * bnk_iban_supported is false for every row: India is not in the IBAN
--     registry and Indian branches settle on IFSC, not IBAN.
--   * bnk_is_active = false marks banks whose licence has been surrendered or
--     whose business was amalgamated into another bank. The row is NOT deleted so
--     that historical bank-account references keep resolving.
--
-- Idempotent: rows already present (case-insensitive bnk_name) are skipped.
-- Run: psql "$DATABASE_URL" -f prisma/seed/Bank_Master.sql

INSERT INTO fixed.bank_master
    (bnk_name, bnk_short_name, bnk_alias, bnk_rbi_code,
     bnk_iban_supported, bnk_is_active, bnk_is_deleted, bnk_created_by)
SELECT v.bnk_name, v.bnk_short_name, v.bnk_alias, v.bnk_rbi_code,
       v.bnk_iban_supported, v.bnk_is_active, false, 'system'
FROM (VALUES
    -- ============ PUBLIC SECTOR BANKS (12) ============
    ('State Bank of India',                      'SBI',           NULL,                        'SBIN', false, true),
    ('Punjab National Bank',                     'PNB',           NULL,                        'PUNB', false, true),
    ('Bank of Baroda',                           'BOB',           NULL,                        'BARB', false, true),
    ('Canara Bank',                              'CANARA',        NULL,                        'CNRB', false, true),
    ('Union Bank of India',                      'UNIONBANK',     NULL,                        'UBIN', false, true),
    ('Bank of India',                            'BOI',           NULL,                        'BKID', false, true),
    ('Indian Bank',                              'INDIANBANK',    NULL,                        'IDIB', false, true),
    ('Central Bank of India',                    'CBI',           NULL,                        'CBIN', false, true),
    ('Indian Overseas Bank',                     'IOB',           NULL,                        'IOBA', false, true),
    ('UCO Bank',                                 'UCO',           'United Commercial Bank',    'UCBA', false, true),
    ('Bank of Maharashtra',                      'BOM',           NULL,                        'MAHB', false, true),
    ('Punjab & Sind Bank',                       'PSB',           NULL,                        'PSIB', false, true),

    -- ============ PRIVATE SECTOR BANKS (21) ============
    ('HDFC Bank',                                'HDFC',          NULL,                        'HDFC', false, true),
    ('ICICI Bank',                               'ICICI',         NULL,                        'ICIC', false, true),
    ('Axis Bank',                                'AXIS',          'UTI Bank',                  'UTIB', false, true),
    ('Kotak Mahindra Bank',                      'KOTAK',         NULL,                        'KKBK', false, true),
    ('IndusInd Bank',                            'INDUSIND',      NULL,                        'INDB', false, true),
    ('Yes Bank',                                 'YESBANK',       NULL,                        'YESB', false, true),
    ('IDFC First Bank',                          'IDFCFIRST',     'IDFC Bank',                 'IDFB', false, true),
    ('IDBI Bank',                                'IDBI',          NULL,                        'IBKL', false, true),
    ('Federal Bank',                             'FEDERAL',       NULL,                        'FDRL', false, true),
    ('South Indian Bank',                        'SIB',           NULL,                        'SIBL', false, true),
    ('Karur Vysya Bank',                         'KVB',           NULL,                        'KVBL', false, true),
    ('City Union Bank',                          'CUB',           NULL,                        'CIUB', false, true),
    ('Tamilnad Mercantile Bank',                 'TMB',           NULL,                        'TMBL', false, true),
    ('DCB Bank',                                 'DCB',           'Development Credit Bank',   'DCBL', false, true),
    ('RBL Bank',                                 'RBL',           'Ratnakar Bank',             'RATN', false, true),
    ('Bandhan Bank',                             'BANDHAN',       NULL,                        'BDBL', false, true),
    ('CSB Bank',                                 'CSB',           'Catholic Syrian Bank',      'CSBK', false, true),
    ('Dhanlaxmi Bank',                           'DHANLAXMI',     NULL,                        'DLXB', false, true),
    ('Jammu & Kashmir Bank',                     'JKBANK',        NULL,                        'JAKA', false, true),
    ('Karnataka Bank',                           'KARNATAKABANK', NULL,                        'KARB', false, true),
    ('Nainital Bank',                            'NAINITAL',      NULL,                        'NTBL', false, true),

    -- ============ SMALL FINANCE BANKS (12) ============
    ('AU Small Finance Bank',                    'AUSFB',         NULL,                        'AUBL', false, true),
    ('Equitas Small Finance Bank',               'EQUITASSFB',    NULL,                        'ESFB', false, true),
    ('Ujjivan Small Finance Bank',               'UJJIVANSFB',    NULL,                        'UJVN', false, true),
    ('Jana Small Finance Bank',                  'JANASFB',       NULL,                        'JSFB', false, true),
    ('Suryoday Small Finance Bank',              'SURYODAYSFB',   NULL,                        'SURY', false, true),
    ('ESAF Small Finance Bank',                  'ESAFSFB',       NULL,                        'ESMF', false, true),
    ('Capital Small Finance Bank',               'CAPITALSFB',    NULL,                        'CLBL', false, true),
    ('Utkarsh Small Finance Bank',               'UTKARSHSFB',    NULL,                        'UTKS', false, true),
    ('Unity Small Finance Bank',                 'UNITYSFB',      NULL,                        'UESB', false, true),
    ('Shivalik Small Finance Bank',              'SHIVALIKSFB',   NULL,                        'SMCB', false, true),
    ('North East Small Finance Bank',            'NESFB',         'Slice Small Finance Bank',  'NESF', false, true),
    -- Amalgamated into AU Small Finance Bank w.e.f. 01-04-2024.
    ('Fincare Small Finance Bank',               'FINCARESFB',    NULL,                        'FSFB', false, false),

    -- ============ PAYMENTS BANKS (6) ============
    ('Airtel Payments Bank',                     'AIRTELPB',      NULL,                        'AIRP', false, true),
    ('India Post Payments Bank',                 'IPPB',          'Post Office Payments Bank', 'IPOS', false, true),
    ('Fino Payments Bank',                       'FINOPB',        NULL,                        'FINO', false, true),
    ('Jio Payments Bank',                        'JIOPB',         NULL,                        'JIOP', false, true),
    ('NSDL Payments Bank',                       'NSDLPB',        NULL,                        'NSPB', false, true),
    -- Directed to stop deposits/credits w.e.f. 15-03-2024.
    ('Paytm Payments Bank',                      'PAYTMPB',       NULL,                        'PYTM', false, false),

    -- ============ REGIONAL RURAL BANKS (28, w.e.f. 01-05-2025) ============
    -- IFSC prefixes intentionally NULL -- see the header note.
    ('Andhra Pradesh Grameena Bank',             'APGB',          NULL,                        NULL,   false, true),
    ('Arunachal Pradesh Rural Bank',             'APRB',          NULL,                        NULL,   false, true),
    ('Assam Gramin Vikash Bank',                 'AGVB',          NULL,                        NULL,   false, true),
    ('Bihar Gramin Bank',                        'BIHARGB',       NULL,                        NULL,   false, true),
    ('Chhattisgarh Rajya Gramin Bank',           'CRGB',          NULL,                        NULL,   false, true),
    ('Gujarat Gramin Bank',                      'GUJARATGB',     NULL,                        NULL,   false, true),
    ('Sarva Haryana Gramin Bank',                'SHGB',          NULL,                        NULL,   false, true),
    ('Himachal Pradesh Gramin Bank',             'HPGB',          NULL,                        NULL,   false, true),
    ('Jammu And Kashmir Grameen Bank',           'JKGB',          NULL,                        NULL,   false, true),
    ('Jharkhand Rajya Gramin Bank',              'JRGB',          NULL,                        NULL,   false, true),
    ('Karnataka Gramin Bank',                    'KARNATAKAGB',   NULL,                        NULL,   false, true),
    ('Kerala Gramin Bank',                       'KERALAGB',      NULL,                        NULL,   false, true),
    ('Madhya Pradesh Gramin Bank',               'MPGB',          NULL,                        NULL,   false, true),
    ('Maharashtra Gramin Bank',                  'MAHAGB',        NULL,                        NULL,   false, true),
    ('Manipur Rural Bank',                       'MANIPURRB',     NULL,                        NULL,   false, true),
    ('Meghalaya Rural Bank',                     'MEGHALAYARB',   NULL,                        NULL,   false, true),
    ('Mizoram Rural Bank',                       'MIZORAMRB',     NULL,                        NULL,   false, true),
    ('Nagaland Rural Bank',                      'NAGALANDRB',    NULL,                        NULL,   false, true),
    ('Odisha Grameen Bank',                      'ODISHAGB',      NULL,                        NULL,   false, true),
    ('Puduvai Bharathiar Grama Bank',            'PBGB',          NULL,                        NULL,   false, true),
    ('Punjab Gramin Bank',                       'PUNJABGB',      NULL,                        NULL,   false, true),
    ('Rajasthan Gramin Bank',                    'RAJASTHANGB',   NULL,                        NULL,   false, true),
    ('Tamil Nadu Grama Bank',                    'TNGB',          NULL,                        NULL,   false, true),
    ('Telangana Grameena Bank',                  'TELANGANAGB',   NULL,                        NULL,   false, true),
    ('Tripura Gramin Bank',                      'TRIPURAGB',     NULL,                        NULL,   false, true),
    ('Uttar Pradesh Gramin Bank',                'UPGB',          NULL,                        NULL,   false, true),
    ('Uttarakhand Gramin Bank',                  'UKGB',          NULL,                        NULL,   false, true),
    ('West Bengal Gramin Bank',                  'WBGB',          NULL,                        NULL,   false, true),

    -- ============ FOREIGN BANKS IN INDIA ============
    ('Citibank N.A.',                            'CITI',          'Citibank India',            'CITI', false, true),
    ('HSBC Bank India',                          'HSBC',          'Hongkong & Shanghai Banking Corporation', 'HSBC', false, true),
    ('Standard Chartered Bank',                  'SCB',           NULL,                        'SCBL', false, true),
    ('Deutsche Bank AG',                         'DEUTSCHE',      NULL,                        'DEUT', false, true),
    ('DBS Bank India',                           'DBS',           'Development Bank of Singapore', 'DBSS', false, true),
    ('Barclays Bank PLC',                        'BARCLAYS',      NULL,                        'BARC', false, true),
    ('BNP Paribas',                              'BNPPARIBAS',    NULL,                        'BNPA', false, true),
    ('Bank of America N.A.',                     'BOFA',          NULL,                        'BOFA', false, true),
    ('JPMorgan Chase Bank N.A.',                 'JPMORGAN',      NULL,                        'CHAS', false, true),
    ('MUFG Bank Ltd',                            'MUFG',          'Bank of Tokyo-Mitsubishi UFJ', 'BOTM', false, true),
    ('Sumitomo Mitsui Banking Corporation',      'SMBC',          NULL,                        'SMBC', false, true),
    ('Mizuho Bank Ltd',                          'MIZUHO',        NULL,                        'MHCB', false, true),
    ('Credit Agricole Corporate and Investment Bank', 'CACIB',    'Calyon Bank',               'CRLY', false, true),
    ('Societe Generale',                         'SOCGEN',        NULL,                        'SOGE', false, true),
    ('UBS AG',                                   'UBS',           NULL,                        'UBSW', false, true),
    ('NatWest Markets PLC',                      'NATWEST',       'Royal Bank of Scotland',    'RBOS', false, true),
    ('The Bank of Nova Scotia',                  'SCOTIABANK',    NULL,                        'NOSC', false, true),
    ('American Express Banking Corp',            'AMEX',          NULL,                        'AEIB', false, true),
    ('SBM Bank India',                           'SBM',           'State Bank of Mauritius',   'STCB', false, true),
    ('FirstRand Bank Ltd',                       'FIRSTRAND',     NULL,                        'FIRV', false, true),
    ('Emirates NBD Bank PJSC',                   'EMIRATESNBD',   NULL,                        'EBIL', false, true),
    ('First Abu Dhabi Bank PJSC',                'FAB',           'National Bank of Abu Dhabi','FIRN', false, true),
    ('Abu Dhabi Commercial Bank',                'ADCB',          NULL,                        'ADCB', false, true),
    ('Mashreqbank PSC',                          'MASHREQ',       NULL,                        'MSHQ', false, true),
    ('Doha Bank QPSC',                           'DOHABANK',      NULL,                        'DOHB', false, true),
    ('Qatar National Bank QPSC',                 'QNB',           NULL,                        'QNBA', false, true),
    ('Bank of Bahrain and Kuwait',               'BBK',           NULL,                        'BBKM', false, true),
    ('Bank of Ceylon',                           'BOC',           NULL,                        'BCEY', false, true),
    ('KEB Hana Bank',                            'KEBHANA',       'Korea Exchange Bank',       'KOEX', false, true),
    ('Woori Bank',                               'WOORI',         NULL,                        'HVBK', false, true),
    ('Shinhan Bank',                             'SHINHAN',       NULL,                        'SHBK', false, true),
    ('Industrial Bank of Korea',                 'IBK',           NULL,                        'IBKO', false, true),
    ('KB Kookmin Bank',                          'KOOKMIN',       NULL,                        NULL,   false, true),
    ('Bank of China',                            'BANKOFCHINA',   NULL,                        'BKCH', false, true),
    ('Industrial and Commercial Bank of China',  'ICBC',          NULL,                        'ICBK', false, true),
    ('CTBC Bank Co. Ltd',                        'CTBC',          'Chinatrust Commercial Bank','CTCB', false, true),
    ('Cooperatieve Rabobank U.A.',               'RABOBANK',      NULL,                        'RABO', false, true),
    ('Australia and New Zealand Banking Group',  'ANZ',           NULL,                        'ANZB', false, true),
    ('United Overseas Bank',                     'UOB',           NULL,                        'UOVB', false, true),
    ('Krung Thai Bank PCL',                      'KRUNGTHAI',     NULL,                        'KRTH', false, true),
    ('PT Bank Maybank Indonesia TBK',            'MAYBANK',       NULL,                        NULL,   false, true),
    ('JSC VTB Bank',                             'VTB',           NULL,                        'VTBR', false, true),
    ('Sberbank',                                 'SBERBANK',      NULL,                        NULL,   false, true),
    ('Sonali Bank PLC',                          'SONALI',        NULL,                        NULL,   false, true),
    ('Westpac Banking Corporation',              'WESTPAC',       NULL,                        NULL,   false, true),

    -- ============ URBAN / STATE CO-OPERATIVE BANKS (major) ============
    ('Saraswat Co-operative Bank',               'SARASWAT',      NULL,                        'SRCB', false, true),
    ('The Cosmos Co-operative Bank',             'COSMOS',        NULL,                        'COSB', false, true),
    ('SVC Co-operative Bank',                    'SVC',           'Shamrao Vithal Co-operative Bank', 'SVCB', false, true),
    ('Abhyudaya Co-operative Bank',              'ABHYUDAYA',     NULL,                        'ABHY', false, true),
    ('TJSB Sahakari Bank',                       'TJSB',          'Thane Janata Sahakari Bank','TJSB', false, true),
    ('Bharat Co-operative Bank (Mumbai)',        'BHARATCOOP',    NULL,                        'BCBM', false, true),
    ('Janata Sahakari Bank (Pune)',              'JSBPUNE',       NULL,                        'JSBP', false, true),
    ('NKGSB Co-operative Bank',                  'NKGSB',         NULL,                        'NKGS', false, true),
    ('Apna Sahakari Bank',                       'APNASAHAKARI',  NULL,                        'ASBL', false, true),
    ('Citizen Credit Co-operative Bank',         'CITIZENCREDIT', NULL,                        'CCBL', false, true),
    ('The Thane Bharat Sahakari Bank',           'TBSB',          NULL,                        'TBSB', false, true),
    ('Dombivli Nagari Sahakari Bank',            'DNSB',          NULL,                        'DNSB', false, true),
    ('Nagpur Nagarik Sahakari Bank',             'NGSB',          NULL,                        'NGSB', false, true),
    ('The Kalupur Commercial Co-operative Bank', 'KALUPUR',       NULL,                        'KCCB', false, true),
    ('Rajkot Nagarik Sahakari Bank',             'RNSB',          NULL,                        'RNSB', false, true),
    ('Mehsana Urban Co-operative Bank',          'MEHSANAURBAN',  NULL,                        'MSNU', false, true),
    ('Ahmedabad Mercantile Co-operative Bank',   'AMCO',          NULL,                        'AMCB', false, true),
    ('Nutan Nagarik Sahakari Bank',              'NNSB',          NULL,                        'NNSB', false, true),
    ('The A.P. Mahesh Co-operative Urban Bank',  'APMAHESH',      NULL,                        'APMC', false, true),
    ('The Gujarat State Co-operative Bank',      'GSCB',          NULL,                        'GSCB', false, true),
    ('The Karnataka State Co-operative Apex Bank','KSCAB',        NULL,                        'KSCB', false, true),
    ('The Tamil Nadu State Apex Co-operative Bank','TNSC',        NULL,                        'TNSC', false, true),
    ('The Maharashtra State Co-operative Bank',  'MSCBANK',       NULL,                        NULL,   false, true),
    ('The Kerala State Co-operative Bank',       'KERALABANK',    'Kerala Bank',               NULL,   false, true),

    -- ============ MERGED / DEFUNCT (kept inactive for legacy references) ============
    ('Allahabad Bank',                           'ALLAHABAD',     NULL,                        'ALLA', false, false),
    ('Andhra Bank',                              'ANDHRABANK',    NULL,                        'ANDB', false, false),
    ('Corporation Bank',                         'CORPORATION',   NULL,                        'CORP', false, false),
    ('Syndicate Bank',                           'SYNDICATE',     NULL,                        'SYNB', false, false),
    ('Oriental Bank of Commerce',                'OBC',           NULL,                        'ORBC', false, false),
    ('United Bank of India',                     'UNITEDBANK',    NULL,                        'UTBI', false, false),
    ('Vijaya Bank',                              'VIJAYA',        NULL,                        'VIJB', false, false),
    ('Dena Bank',                                'DENA',          NULL,                        'BKDN', false, false),
    ('State Bank of Travancore',                 'SBT',           NULL,                        'SBTR', false, false),
    ('State Bank of Hyderabad',                  'SBH',           NULL,                        'SBHY', false, false),
    ('State Bank of Mysore',                     'SBMYSORE',      NULL,                        'SBMY', false, false),
    ('State Bank of Patiala',                    'SBP',           NULL,                        'STBP', false, false),
    ('State Bank of Bikaner and Jaipur',         'SBBJ',          NULL,                        'SBBJ', false, false),
    ('Bharatiya Mahila Bank',                    'BMB',           NULL,                        'BMBL', false, false),
    ('Lakshmi Vilas Bank',                       'LVB',           NULL,                        'LAVB', false, false),
    ('ING Vysya Bank',                           'INGVYSYA',      'Vysya Bank',                'VYSA', false, false),
    ('Punjab and Maharashtra Co-operative Bank', 'PMC',           NULL,                        'PMCB', false, false),
    ('Credit Suisse AG',                         'CREDITSUISSE',  NULL,                        'CRES', false, false)
) AS v(bnk_name, bnk_short_name, bnk_alias, bnk_rbi_code, bnk_iban_supported, bnk_is_active)
WHERE NOT EXISTS (
    SELECT 1 FROM fixed.bank_master m
    WHERE lower(m.bnk_name) = lower(v.bnk_name)
);
