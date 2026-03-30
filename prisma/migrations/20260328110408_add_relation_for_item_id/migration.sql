-- AddForeignKey
ALTER TABLE "inventory"."opening_stock_detail" ADD CONSTRAINT "fk_osl_item" FOREIGN KEY ("osl_item_id") REFERENCES "inventory"."item_master"("item_id") ON DELETE RESTRICT ON UPDATE CASCADE;
