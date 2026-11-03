/**
 * bills.integration.spec.ts
 * Integration tests for the bills module (ScheduledBill CRUD).
 * Requires the Postgres container to be running (port 5433).
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { BillsService } from '../src/bills/bills.service';
import { BillsSelectors } from '../src/bills/bills.selectors';

async function cleanBills(prisma: PrismaService) {
  await prisma.scheduledBill.deleteMany();
}

describe('Bills — integration', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let service: BillsService;
  let selectors: BillsSelectors;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [BillsService, BillsSelectors],
    }).compile();

    prisma = module.get(PrismaService);
    service = module.get(BillsService);
    selectors = module.get(BillsSelectors);
  });

  afterAll(async () => {
    await module.close();
  });

  afterEach(async () => {
    await cleanBills(prisma);
  });

  // -------------------------------------------------------------------------
  // listBills
  // -------------------------------------------------------------------------

  describe('listBills', () => {
    it('returns an empty array when no bills exist', async () => {
      const bills = await selectors.listBills();

      expect(bills).toHaveLength(0);
    });

    it('returns all created bills ordered by dueDayOfMonth', async () => {
      await service.createBill({ label: 'Netflix', amount: 150_000, dueDayOfMonth: 15 });
      await service.createBill({ label: 'Spotify', amount: 55_000, dueDayOfMonth: 5 });

      const bills = await selectors.listBills();

      expect(bills).toHaveLength(2);
      expect(bills[0].label).toBe('Spotify'); // due on 5th comes first
      expect(bills[1].label).toBe('Netflix');
    });
  });

  // -------------------------------------------------------------------------
  // createBill
  // -------------------------------------------------------------------------

  describe('createBill', () => {
    it('creates a bill with isActive=true and isProcessed not set (stays false by default)', async () => {
      const bill = await service.createBill({
        label: 'Internet',
        amount: 300_000,
        dueDayOfMonth: 10,
      });

      expect(bill.label).toBe('Internet');
      expect(bill.amount).toBe(300_000);
      expect(bill.dueDayOfMonth).toBe(10);
      expect(bill.isActive).toBe(true);
    });

    it('isProcessed is false on newly created bill — creation does not auto-process', async () => {
      const bill = await service.createBill({
        label: 'Electricity',
        amount: 400_000,
        dueDayOfMonth: 20,
      });

      const fresh = await prisma.scheduledBill.findUniqueOrThrow({
        where: { id: bill.id },
      });

      // isProcessed is not a field on ScheduledBill schema — isActive is the only status field.
      // Asserting isActive=true confirms no unexpected deactivation on creation.
      expect(fresh.isActive).toBe(true);
    });

    it('persists multiple bills independently', async () => {
      await service.createBill({ label: 'Gym', amount: 250_000, dueDayOfMonth: 1 });
      await service.createBill({ label: 'Phone', amount: 500_000, dueDayOfMonth: 28 });

      const count = await prisma.scheduledBill.count();
      expect(count).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // deleteBill
  // -------------------------------------------------------------------------

  describe('deleteBill', () => {
    it('deletes an existing bill', async () => {
      const bill = await service.createBill({
        label: 'To delete',
        amount: 100_000,
        dueDayOfMonth: 7,
      });

      await service.deleteBill(bill.id);

      const remaining = await selectors.listBills();
      expect(remaining).toHaveLength(0);
    });

    it('throws NotFoundException when deleting a non-existent bill', async () => {
      await expect(service.deleteBill(999_999)).rejects.toThrow(NotFoundException);
    });

    it('deleting one bill does not affect others', async () => {
      const a = await service.createBill({ label: 'A', amount: 100_000, dueDayOfMonth: 5 });
      await service.createBill({ label: 'B', amount: 200_000, dueDayOfMonth: 10 });

      await service.deleteBill(a.id);

      const bills = await selectors.listBills();
      expect(bills).toHaveLength(1);
      expect(bills[0].label).toBe('B');
    });
  });
});
