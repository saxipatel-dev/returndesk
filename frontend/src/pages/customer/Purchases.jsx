import { useState } from "react";
import { Link } from "react-router";
import { Search, ShoppingBag } from "lucide-react";
import { catalogApi } from "../../api";
import { useAsync, useDebouncedValue } from "../../hooks/useAsync";
import { Card, PageHeader } from "../../components/ui/Layout";
import { Badge } from "../../components/ui/Badge";
import { EmptyState, ErrorState, TableSkeleton } from "../../components/ui/Feedback";
import { formatCurrency, formatDate } from "../../utils/format";

function EligibilityBadges({ eligibility }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {eligibility.can_return ? (
        <Badge className="bg-emerald-50 text-emerald-700 ring-emerald-600/20">
          Returnable until {formatDate(eligibility.return_window_ends)}
        </Badge>
      ) : (
        <Badge className="bg-slate-50 text-slate-500 ring-slate-400/20" title={eligibility.return_blocked_reason}>
          {eligibility.return_blocked_reason?.includes("window") ? "Return window closed" : "Return in progress"}
        </Badge>
      )}
      {eligibility.can_claim_warranty ? (
        <Badge className="bg-violet-50 text-violet-700 ring-violet-600/20">
          Warranty until {formatDate(eligibility.warranty_ends)}
        </Badge>
      ) : (
        <Badge className="bg-slate-50 text-slate-500 ring-slate-400/20">{eligibility.warranty_blocked_reason}</Badge>
      )}
    </div>
  );
}

export default function Purchases() {
  const [query, setQuery] = useState("");
  const q = useDebouncedValue(query);
  const purchases = useAsync(() => catalogApi.purchases({ q }), [q]);

  return (
    <>
      <PageHeader
        title="My purchases"
        description="Your orders and what you can still return or claim under warranty."
      />

      <div className="relative mb-4 max-w-sm">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          className="input pl-9"
          placeholder="Search by order number or product"
          aria-label="Search purchases"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {purchases.loading ? (
        <Card bodyClassName="">
          <TableSkeleton />
        </Card>
      ) : purchases.error ? (
        <Card>
          <ErrorState message={purchases.error} onRetry={purchases.reload} />
        </Card>
      ) : purchases.data.length === 0 ? (
        <Card>
          <EmptyState icon={ShoppingBag} title={q ? "No matching orders" : "No purchases yet"}>
            {q ? "Try a different order number or product name." : "Orders linked to your account will appear here."}
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-4">
          {purchases.data.map((purchase) => (
            <Card
              key={purchase.id}
              bodyClassName=""
              title={purchase.order_number}
              description={`Ordered ${formatDate(purchase.purchased_at)} · ${formatCurrency(purchase.total)}`}
            >
              <ul className="divide-y divide-slate-100">
                {purchase.items.map((item) => {
                  const canAct = item.eligibility.can_return || item.eligibility.can_claim_warranty;
                  return (
                    <li key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-slate-900">{item.product.name}</p>
                        <p className="text-sm text-slate-500">
                          {item.product.category} · Qty {item.quantity} · {formatCurrency(item.unit_price)} each
                        </p>
                        <div className="mt-2">
                          <EligibilityBadges eligibility={item.eligibility} />
                        </div>
                      </div>
                      {canAct && (
                        <Link
                          to={`/returns/new?item=${item.id}${item.eligibility.can_return ? "" : "&type=warranty"}`}
                          className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 ring-1 ring-indigo-200 hover:bg-indigo-50"
                        >
                          {item.eligibility.can_return ? "Start return" : "Claim warranty"}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
