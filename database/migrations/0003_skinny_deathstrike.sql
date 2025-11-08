CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"category" text NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversation" ADD COLUMN "tool_id" text;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "memories_user_tenant_idx" ON "memories" USING btree ("user_id","tenant_id");--> statement-breakpoint
CREATE INDEX "memories_category_idx" ON "memories" USING btree ("category");--> statement-breakpoint
CREATE INDEX "memories_user_tenant_category_idx" ON "memories" USING btree ("user_id","tenant_id","category");--> statement-breakpoint
CREATE INDEX "conversation_user_org_updated_idx" ON "conversation" USING btree ("user_id","organization_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversation_org_updated_idx" ON "conversation" USING btree ("organization_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "message_conversation_created_idx" ON "message" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "message_org_created_idx" ON "message" USING btree ("organization_id","created_at" DESC NULLS LAST);