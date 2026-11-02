import { describe, expect, it } from 'vitest';
import { CPP_2027, EI_2027 } from '../src/data/2027/cpp-ei';
import { QPP_2027, QPIP_2027 } from '../src/data/2027/quebec';
import { getTables } from '../src/data/index';

describe('CPP_2027 table', () => {
  it('has the exact 2027 field values', () => {
    expect(CPP_2027.year).toBe(2027);
    expect(CPP_2027.ympe).toBe(76_700);
    expect(CPP_2027.yampe).toBe(87_400);
    expect(CPP_2027.basicExemption).toBe(3_500);
    expect(CPP_2027.employeeRate).toBe(0.0575);
    expect(CPP_2027.baseRate).toBe(0.0475);
    expect(CPP_2027.cpp2Rate).toBe(0.04);
  });

  it('derives the maximum contributions arithmetically', () => {
    expect(
      (CPP_2027.ympe - CPP_2027.basicExemption) * CPP_2027.employeeRate,
    ).toBeCloseTo(4209.0, 2);
    expect((CPP_2027.yampe - CPP_2027.ympe) * CPP_2027.cpp2Rate).toBeCloseTo(
      428.0,
      2,
    );
  });
});

describe('EI_2027 table', () => {
  it('has the exact 2027 field values', () => {
    expect(EI_2027.year).toBe(2027);
    expect(EI_2027.maxInsurableEarnings).toBe(70_800);
    expect(EI_2027.employeeRate).toBe(0.0164);
    expect(EI_2027.employeeRateQuebec).toBe(0.0129);
    expect(EI_2027.employerMultiple).toBe(1.4);
  });

  it('derives the maximum employee premiums', () => {
    expect(EI_2027.maxInsurableEarnings * EI_2027.employeeRate).toBeCloseTo(
      1161.12,
      2,
    );
    expect(
      EI_2027.maxInsurableEarnings * EI_2027.employeeRateQuebec,
    ).toBeCloseTo(913.32, 2);
  });
});

describe('2027 table verification status', () => {
  it('marks CPP_2027 unverified and EI_2027 verified', () => {
    expect(CPP_2027.meta.verified).toBe(false);
    expect(EI_2027.meta.verified).toBe(true);
  });

  it('marks the Quebec 2027 placeholders unverified', () => {
    expect(QPP_2027.meta.verified).toBe(false);
    expect(QPIP_2027.meta.verified).toBe(false);
  });
});

describe('2027 edition registration', () => {
  it('getTables throws for 2027-01-15 — deliberate: 2027 editions are NOT registered until T4127 (January 2027) publishes federal/provincial tables', () => {
    expect(() => getTables('2027-01-15')).toThrow();
  });
});
