-- The 35 farms whose addresses resolve only to postcode/postal-town level.
--
-- Generated 2026-08-23 alongside the coordinate backfill. NOT applied: these
-- put the pin in the right village, not on the farm, and once written they are
-- indistinguishable from street-accurate coordinates.
--
-- Six of them share a point with another farm — four around Tvååker land on
-- 57.0413621, 12.3991052 and would stack as a single marker.
--
-- Most are Swedish property designations (fastighetsbeteckningar) such as
-- "Hemse Hulte 531", which OpenStreetMap does not carry. Better addresses at
-- source would beat applying these.
--
-- To apply, see docs/running-scripts-in-production.md.

UPDATE farms SET lat=55.8371511, lng=14.0892635 WHERE id='blaherremolla' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=56.1980903, lng=15.6558686 WHERE id='butik-oljersjo' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=55.4580331, lng=14.1808853 WHERE id='domain-sanana' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.2681715, lng=12.3374641 WHERE id='ekkullens-farfarm' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.2814458, lng=18.4714278 WHERE id='ekofrida' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=58.4823201, lng=15.517719 WHERE id='elins-lockar' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=58.3955804, lng=15.0867705 WHERE id='flaskomat' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=56.2112331, lng=15.2408198 WHERE id='fru-hjarnfro' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.3863942, lng=18.2028447 WHERE id='hejde-knacke' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.3893962, lng=12.7271846 WHERE id='hesselby-jernvagskafe' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.2401493, lng=18.3800194 WHERE id='hulte-eko' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.0413621, lng=12.3991052 WHERE id='jarnvirke-honseri-ab' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.4331884, lng=18.8446062 WHERE id='krakas-krog' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.5073932, lng=18.4506134 WHERE id='lamm-bi' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.9875021, lng=15.622841 WHERE id='landets-goda-specerihandel-restaurang-hotell-konferens' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.8231268, lng=12.1719169 WHERE id='lilla-jordbruket' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=55.7260391, lng=14.1049163 WHERE id='linas-och-binas-ab' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=56.1928572, lng=14.7532545 WHERE id='ljungsleds-plantskola' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=58.3543146, lng=15.2884932 WHERE id='lyckans-land' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=58.5909124, lng=16.1903511 WHERE id='minsjo-sateri' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=56.8205894, lng=12.7478385 WHERE id='perstorp101' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.7851621, lng=18.7906376 WHERE id='rot' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.0413621, lng=12.3991052 WHERE id='ragnarssons-ekologiskt-naturligtvis' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.0413621, lng=12.3991052 WHERE id='restaurang-logen' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.0413621, lng=12.3991052 WHERE id='restaurang-ang' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.2401493, lng=18.3800194 WHERE id='rone-smissarve-gronsaker-bar' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=56.0436463, lng=14.2805516 WHERE id='roda-langan-ab' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=58.6755226, lng=13.9420144 WHERE id='rorsas-lantliv' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.1616007, lng=18.3320376 WHERE id='sigsarve-lamb' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=56.102213, lng=13.9095768 WHERE id='skanska-vilt-ab' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=58.3891661, lng=13.5747695 WHERE id='snickaretorpet-vedugn-butik' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=57.900445, lng=15.8426843 WHERE id='stora-hycklinge' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=58.1446436, lng=11.9383898 WHERE id='tegens-butik' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=58.1253446, lng=11.7197673 WHERE id='varekils-slakteri' AND (lat IS NULL OR lng IS NULL);
UPDATE farms SET lat=55.8360324, lng=13.5775657 WHERE id='vidablick-krav-odlade-gronsaker' AND (lat IS NULL OR lng IS NULL);
