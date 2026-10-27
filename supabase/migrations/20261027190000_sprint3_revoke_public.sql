-- SPRINT 3 durcissement — les RPC du dossier d'achat sont réservées aux
-- utilisateurs connectés. Postgres accorde EXECUTE à PUBLIC par défaut à la
-- création d'une fonction : on révoque explicitement (défense en profondeur —
-- chaque fonction vérifie déjà auth.uid(), aucune donnée n'était exposée).

revoke all on function public.dossier_add(uuid) from public, anon;
revoke all on function public.dossier_list() from public, anon;
revoke all on function public.dossier_set_statut(uuid, text) from public, anon;
revoke all on function public.dossier_set_alertes(uuid, boolean) from public, anon;
revoke all on function public.dossier_remove(uuid) from public, anon;
revoke all on function public.submit_outcome(uuid, integer, text, text) from public, anon;
