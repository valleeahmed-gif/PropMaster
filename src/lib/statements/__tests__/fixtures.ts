// Synthetic statements laid out like the real documents. All names, numbers
// and addresses are invented.

export const COJ = `
City of Johannesburg                                         TAX INVOICE
PO Box 5000 Johannesburg 2000   www.joburg.org.za
MR T TENANT-OWNER                                Date                  2026/07/06
12 EXAMPLE ROAD                                  Statement for         July 2026
MORNINGSIDE 2196                                 Account Number        550123456
Stand No./Portion  00123/00000   Township  MORNINGSIDE EXT 40   Stand Size  496 m2
Municipal Valuation  R 1,280,000.00    Date of Valuation  2023/07/01
Next Reading Date  2026/07/10                    Deposit : R 1,500.00

Previous Account Balance                                              4,210.33
Sub Total                                                             4,210.33
Less : Payment (Thank You)   2026/06/22                              -4,210.33
Current Charges (Excl. VAT)                                           4,094.88
VAT @ 15%                                                               508.69
Total Due                                                             4,603.57
Due Date  2026/07/21
90 Days+  0.00   60 Days  0.00   30 Days  0.00   Current  4,603.57   Total Outstanding  4,603.57

Property Rates
Category of Property : Residential
Market Value: R 1,280,000.00 ; Billing Period 2026/07 (R 1,280,000.00 x R 0.0086160 / 12)       919.04
Less rates on first R300 000.00 of market value                              -215.40
                                                                              703.64
City Power (VAT Reg. No. 4710191182)
Electricity
Meter: 9000123456; Consumption: 623.000 kWh; Type: Actual
Reading period = 2026/05/11 to 2026/06/09 (30 days)
Start reading: 12345.000  End reading: 12968.000
Charge: Step 1    500.000 kWh @ R 2.1234 = R 1,061.70
Charge: Step 2    123.000 kWh @ R 2.4368 = R 299.73
Service charge                                                                184.56
Network charge                                                                600.52
VAT: 15.00 %                                                                  321.98
                                                                            2,468.49
Johannesburg Water (VAT Reg. No. 4270191077)
Water & Sanitation
Meter: W7700123; Consumption: 18.000 KL; Type: Actual
Reading period = 2026/05/14 to 2026/06/12 (30 days)
Step 1    6.000 KL @ R 0.0000 = R 0.00
Step 2    4.000 KL @ R 61.8000 = R 247.20
Step 3    8.000 KL @ R 23.8050 = R 190.44
Water Demand Management Levy                                                   65.09
Sewer monthly charge based on stand size 496 m2                               432.00
VAT: 15.00 %                                                                  140.21
                                                                            1,074.94
PIKITUP (VAT Reg. No. 4790191292)
Refuse
Refuse Residential ; Billing Period 2026/07 (based on property value)         310.00
VAT: 15.00 %                                                                   46.50
                                                                              356.50
Please pay R 4,603.57 by 2026/07/21. Banking details: Standard Bank, Branch code 000205.
`;

// Same statement, but electricity was estimated and one detail line is unreadable.
export const COJ_ESTIMATED = COJ
  .replace('Consumption: 623.000 kWh; Type: Actual', 'Consumption: 623.000 kWh; Type: Estimate');

// A statement where a section is wrong / missing: totals must NOT reconcile.
export const COJ_MISSING_SECTION = COJ.split('PIKITUP (VAT Reg. No. 4790191292)')[0];

// Table-style municipal account (one row per service: excl, VAT, incl).
export const MUNICIPAL_TABLE = `
City of Cape Town                                  Tax Invoice
Account number 123456789      Invoice date 03/08/2026     Due date 28/08/2026
Account for August 2026
Previous balance                                                       2,100.00
Payment - thank you 25/07/2026                                         2,100.00-
Description                         Excl VAT          VAT            Total
Property Rates                        812.40          0.00           812.40
Electricity (412 kWh)               1,236.00        185.40         1,421.40
Water (9 kl)                          310.00         46.50           356.50
Sewerage                              217.00         32.55           249.55
Refuse                                160.00         24.00           184.00
Current month's charges                                              3,023.85
Total amount due                                                     3,023.85
`;

// Charges listed excluding VAT, with VAT only in the summary.
export const MUNICIPAL_EXCL = `
eThekwini Municipality
Tax Invoice    Statement date 2026/09/04    Account No: 77001234567
Current Charges (Excl. VAT)                                            1,000.00
VAT @ 15%                                                                 90.00
Total due                                                              1,090.00
Rates                                                                    400.00
Electricity                                                              350.00
Water                                                                    150.00
Refuse                                                                   100.00
`;

// Managing agent levy statement: transaction list with Debit / Credit / Balance.
export const LEVY_TRANSACTIONS = `
SUNSET VIEW BODY CORPORATE (SS 123/2008)
Managed by Example Property Management (Pty) Ltd
Levy Statement                                   Statement date: 01/08/2026
Unit 14 - Section 14                             Account no: SUN014
Date          Reference     Description                         Debit        Credit       Balance
01/07/2026                  Balance brought forward                                      2,184.50
01/07/2026    LEV0726       Levy - Administrative Fund         1,850.00                  4,034.50
01/07/2026    RES0726       Reserve Fund Levy                    277.50                  4,312.00
01/07/2026    CSOS0726      CSOS Levy                             27.00                  4,339.00
05/07/2026    RCPT4471      Payment received - thank you                   2,184.50      2,154.50
01/08/2026    LEV0826       Levy - Administrative Fund         1,850.00                  4,004.50
01/08/2026    RES0826       Reserve Fund Levy                    277.50                  4,282.00
01/08/2026    CSOS0826      CSOS Levy                             27.00                  4,309.00
01/08/2026    WAT0726       Water recovery (11 kl)               398.20                  4,707.20
01/08/2026    ELE0726       Electricity recovery (310 kWh)       905.75                  5,612.95
01/08/2026    INT0826       Interest on arrears                   21.55                  5,634.50
Total amount due                                                                         5,634.50
`;

// Simple levy invoice: description + amount.
export const LEVY_INVOICE = `
Oakwood Estate Homeowners Association
Levy invoice for September 2026            Invoice date 1 September 2026
Erf 221
Monthly levy                           2,450.00
Security levy                            680.00
Special levy - road resurfacing          500.00
Total amount due                       3,630.00
Payment due by 7 September 2026
`;

// Afrikaans municipal layout with decimal commas.
export const MUNICIPAL_AFRIKAANS = `
Drakenstein Munisipaliteit                 Belastingfaktuur
Rekeningnommer: 1002003004       Datum: 2026/10/02     Staat vir Oktober 2026
Eiendomsbelasting                                    612,30
Elektrisiteit                                      1 045,80
Water                                                288,15
Riool                                                190,00
Vullisverwydering                                    175,25
Huidige heffings                                   2 311,50
Totaal verskuldig                                  2 311,50
`;

// OCR slip: the rebate's minus sign was lost, so the rates lines no longer add up.
export const COJ_LOST_MINUS = COJ.replace('-215.40', '215.40');

// OCR slips in both a detail line and the "current charges" summary figure.
export const COJ_MISREAD_SUMMARY = COJ.replace('-215.40', '215.40').replace(/919\.04/, '910.04').replace('4,094.88', '4,004.88');
