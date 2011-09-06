--**********************************************
--*            Shock - Archive Thing
--* Authors:  
--*      Jared Wilkening (jared@mcs.anl.gov)
--*      Narayan Desai   (desai@mcs.anl.gov)
--*      Folker Meyer    (folker@anl.gov)
--**********************************************

drop table if exists objects cascade;
drop table if exists indexes cascade;
drop table if exists pending_uploads cascade;
drop table if exists meta cascade;

drop sequence if exists type_seq, format_seq, obj_seq, index_seq, pending_seq, meta_seq cascade;

create sequence type_seq;
create sequence format_seq;
create sequence obj_seq;
create sequence index_seq;
create sequence pending_seq;		
create sequence meta_seq;

create table objects (
	obj_key			int primary key default nextval('obj_seq'),
	obj_name		text default null,
	file_name		text default null,
	file_size		int default null,
	file_checksum	char(32),	
	pending_upload	boolean default True,
	pending_index 	boolean default True,
	creation		timestamp DEFAULT current_timestamp,
	last_modified	timestamp default null
);

create table indexes (
	index_key 		int primary key default nextval('index_seq'),
	obj_key			int references objects(obj_key) on delete cascade,
	file_offset		int not null,
	file_len		int not null,
	rec_start		int default null,
	rec_end			int default null
);

create table pending_uploads (
	pending_key		int primary key default nextval('pending_seq'),
	obj_key			int references objects(obj_key) on delete cascade,
	part			int not null,
	file_name		text default null,
	file_size		int default null,
	file_checksum	char(32) default null	
);

create table meta (
	meta_key	int primary key default nextval('meta_seq'),
	obj_key		int references objects(obj_key) on delete cascade,
	tag			text not null,
	value		text not null
);
