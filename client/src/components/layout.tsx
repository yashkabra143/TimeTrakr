import CardNav from './card-nav';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <CardNav>
      {children}
    </CardNav>
  );
}
