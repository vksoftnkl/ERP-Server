-- AddForeignKey
ALTER TABLE "sales"."customers" ADD CONSTRAINT "customers_cus_price_level_id_fkey" FOREIGN KEY ("cus_price_level_id") REFERENCES "inventory"."item_price_levels"("ipl_id") ON DELETE RESTRICT ON UPDATE CASCADE;
