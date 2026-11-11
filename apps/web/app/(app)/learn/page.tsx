import { BookOpen } from "lucide-react";
import { Card } from "@fluravest/ui";

const articles = [
  { title: "How a land pod works", body: "A verified parcel is priced and split into 5 or 6 equal slots. Each member claims one slot. When every slot is taken, the pod is full, funds are locked, and FluraVest completes the purchase on the pod's behalf. Each member then receives a co-ownership certificate." },
  { title: "What the free withdrawal window is", body: "Four times a year (21–31 March, 21–30 June, 21–30 September and 21–31 December) you can withdraw without a fee. Outside those days a 5% fee applies. It's there to help you stick to your plan, and you'll always see the exact fee before you confirm." },
  { title: "Reading a title document", body: "C of O (Certificate of Occupancy) is issued by the state. A Gazette shows that land was released from government acquisition. A Deed of Assignment transfers an interest from one person to another. A survey plan shows the exact boundaries. We list which documents were reviewed for every parcel." },
  { title: "What “illiquid” means", body: "After a pod closes, your money is in land, not cash. You can't withdraw it like savings. It becomes cash again when the land is sold, or when another buyer takes over your slot." },
  { title: "Fees, in full", body: "Legal and title fee: 2–5% of your slot price, shown on every deal and held with your slot. Early withdrawal fee: 5%, only outside the free window. Pods that don't fill, or that you leave before they fill, cost nothing." },
];

export default function LearnPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-h3 text-text">Learn</h1>
        <p className="text-body-sm text-text-secondary">Plain-language guides to saving and co-owning land.</p>
      </div>
      {articles.map((a) => (
        <Card as="article" key={a.title}>
          <h2 className="flex items-center gap-2 text-title text-text"><BookOpen className="h-5 w-5 text-text-positive" aria-hidden />{a.title}</h2>
          <p className="mt-2 text-body text-text-secondary">{a.body}</p>
        </Card>
      ))}
    </div>
  );
}
